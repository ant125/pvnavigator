import { NextResponse, type NextRequest } from "next/server";
import { getHubOrigin } from "@pv-auth/session";
import { PAID_PLANS } from "@pv-access/core";

import { billingFormAllowed, redirectLoginForTariff, redirectTarife } from "@/lib/billing/billingHttp";
import {
  existingStripeCustomerInvoiceParams,
  newStripeCustomerParams,
} from "@/lib/billing/checkoutInvoice";
import { isStripeRedirectUrl } from "@/lib/billing/stripeEvents";
import {
  BillingNotConfiguredError,
  BillingPriceError,
  assertPlanPrice,
  checkoutSubmitMessage,
  getStripe,
} from "@/lib/billing/stripeServer";
import {
  storedUpgradeSessionDisposition,
  upgradeCheckoutSession,
  upgradeTargetFromForm,
  type UpgradeTargetId,
} from "@/lib/billing/upgradeCheckout";
import { getServerUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpgradeCheckout = {
  url?: string;
  session_id?: string | null;
  customer_id: string | null;
  replaces_subscription_id: string | null;
  period_id: string;
  plan?: string;
};

type Reserve =
  | ({ action: "create" } & UpgradeCheckout)
  | ({ action: "reuse" } & UpgradeCheckout)
  | { action: "pending" }
  | { action: "busy" }
  | { action: "ineligible" }
  | { action: "forbidden" };

function authorizedTarget(plan: string | undefined): UpgradeTargetId | null {
  return plan === "abo" || plan === "pro" ? plan : null;
}

function reserveStopped(reserve: Reserve, requested: UpgradeTargetId): Response | null {
  if (reserve.action === "forbidden") return redirectLoginForTariff(requested);
  if (reserve.action === "busy") return redirectTarife("bitte-warten");
  if (reserve.action === "ineligible") return redirectTarife("upgrade-ungueltig");
  if (reserve.action === "pending") return redirectTarife("upgrade-ausstehend");
  return null;
}

function isCheckout(reserve: Reserve): reserve is Extract<Reserve, { action: "create" | "reuse" }> {
  return reserve.action === "create" || reserve.action === "reuse";
}

/**
 * Starts a separate Checkout for STARTER → ABO, STARTER → PRO, or ABO → PRO.
 * Does not change the current period or the existing subscription.
 * Only a later invoice.paid opens the higher plan. A missing plan stays PRO,
 * which is what the existing ABO button posts.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!billingFormAllowed(request)) return redirectTarife();

  let requested: UpgradeTargetId | null;
  try {
    requested = upgradeTargetFromForm((await request.formData()).get("plan"));
  } catch {
    return redirectTarife("zahlung-fehler");
  }
  if (!requested) return redirectTarife("upgrade-ungueltig");

  const user = await getServerUser();
  if (!user) return redirectLoginForTariff(requested);

  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!stripe || !admin) return redirectTarife("nicht-konfiguriert");
  const billingAdmin = admin;
  const account = user;

  async function loadReserve(): Promise<Reserve | Response> {
    const reserved = await billingAdmin.rpc("reserve_stripe_upgrade_checkout", {
      p_user: account.id,
      p_plan: requested,
    });
    if (reserved.error || !reserved.data || typeof reserved.data !== "object") {
      console.error("reserve_stripe_upgrade_checkout failed");
      return redirectTarife("nicht-konfiguriert");
    }
    return reserved.data as Reserve;
  }

  const loaded = await loadReserve();
  if (loaded instanceof Response) return loaded;
  let reserve = loaded;
  let target = authorizedTarget(isCheckout(reserve) ? reserve.plan : undefined);

  // invoice_paid has no Checkout Session id. A paid session is recognized here,
  // and only the claim row that still stores that exact session is closed.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stopped = reserveStopped(reserve, requested);
    if (stopped) return stopped;
    if (!isCheckout(reserve)) return redirectTarife("upgrade-ungueltig");
    target = authorizedTarget(reserve.plan);
    if (!target) return redirectTarife("upgrade-ungueltig");
    if (!reserve.session_id) break;

    let disposition: ReturnType<typeof storedUpgradeSessionDisposition>;
    try {
      const existing = await stripe.checkout.sessions.retrieve(reserve.session_id);
      disposition = storedUpgradeSessionDisposition({
        paymentStatus: existing.payment_status,
        status: existing.status,
        planKey: existing.metadata?.plan_key ?? null,
        targetPlanKey: PAID_PLANS[target].planKey,
      });
    } catch (error) {
      await billingAdmin.rpc("release_stripe_checkout_claim", { p_user: account.id });
      console.error("Stripe upgrade session lookup failed", error instanceof Error ? error.name : "error");
      return redirectTarife("zahlung-fehler");
    }

    if (disposition === "block-open") return redirectTarife("upgrade-ausstehend");
    if (disposition === "reuse") break;

    const closed = await billingAdmin.rpc("close_completed_stripe_checkout_session", {
      p_user: account.id,
      p_session_id: reserve.session_id,
    });
    if (closed.error) {
      await billingAdmin.rpc("release_stripe_checkout_claim", { p_user: account.id });
      console.error("close_completed_stripe_checkout_session failed");
      return redirectTarife("zahlung-fehler");
    }
    if (reserve.action !== "reuse") {
      reserve = { ...reserve, session_id: null };
      break;
    }
    if (attempt === 1) return redirectTarife("zahlung-fehler");
    const again = await loadReserve();
    if (again instanceof Response) return again;
    reserve = again;
  }

  if (!isCheckout(reserve) || !target) return redirectTarife("upgrade-ungueltig");
  if (reserve.action === "reuse") {
    if (reserve.url && isStripeRedirectUrl(reserve.url, "checkout")) {
      return NextResponse.redirect(reserve.url, 303);
    }
    return redirectTarife("zahlung-fehler");
  }

  let customerId = reserve.customer_id;
  try {
    const price = await assertPlanPrice(stripe, target);
    if (price.planKey !== PAID_PLANS[target].planKey || price.amount !== PAID_PLANS[target].priceCents) {
      throw new BillingPriceError();
    }
    if (!customerId) {
      const customer = await stripe.customers.create(
        newStripeCustomerParams({ userId: account.id, email: account.email }),
        { idempotencyKey: `pvn-customer-${account.id}` },
      );
      customerId = customer.id;
      const linked = await billingAdmin.rpc("link_stripe_customer", {
        p_user: account.id,
        p_customer_id: customerId,
      });
      const result =
        linked.data && typeof linked.data === "object"
          ? (linked.data as { result?: string }).result
          : null;
      if (linked.error || result !== "linked") {
        await billingAdmin.rpc("release_stripe_checkout_claim", { p_user: account.id });
        return redirectTarife("zahlung-fehler");
      }
    } else {
      await stripe.customers.update(customerId, existingStripeCustomerInvoiceParams());
    }

    const sessionInput = upgradeCheckoutSession({
      userId: account.id,
      customerId,
      priceId: price.priceId,
      plan: target,
      replacesSubscriptionId: reserve.replaces_subscription_id,
      periodId: reserve.period_id,
      origin: getHubOrigin(),
      submitMessage: checkoutSubmitMessage(PAID_PLANS[target].priceLabel),
    });
    const { idempotencyKey, ...sessionParams } = sessionInput;
    const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey });

    if (!session.url || !isStripeRedirectUrl(session.url, "checkout")) {
      await billingAdmin.rpc("release_stripe_checkout_claim", { p_user: account.id });
      return redirectTarife("zahlung-fehler");
    }
    await billingAdmin.rpc("store_stripe_checkout_session", {
      p_user: account.id,
      p_session_id: session.id,
      p_url: session.url,
      p_expires_at: new Date(session.expires_at * 1000).toISOString(),
    });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    await billingAdmin.rpc("release_stripe_checkout_claim", { p_user: account.id });
    if (error instanceof BillingNotConfiguredError) {
      return redirectTarife(target === "pro" ? "pro-preis" : "nicht-konfiguriert");
    }
    if (error instanceof BillingPriceError) return redirectTarife("preis");
    console.error("Stripe upgrade Checkout failed", error instanceof Error ? error.name : "error");
    return redirectTarife("zahlung-fehler");
  }
}
