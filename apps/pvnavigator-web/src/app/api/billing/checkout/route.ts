import { NextResponse, type NextRequest } from "next/server";
import { PAID_PLANS, paidPlanById } from "@pv-access/core";
import { getHubOrigin } from "@pv-auth/session";
import { billingFormAllowed, redirectLoginForTariff, redirectTarife } from "@/lib/billing/billingHttp";
import { isStripeRedirectUrl } from "@/lib/billing/stripeEvents";
import {
  existingStripeCustomerInvoiceParams,
  initialCheckoutSession,
  newStripeCustomerParams,
} from "@/lib/billing/checkoutInvoice";
import {
  BillingNotConfiguredError,
  BillingPriceError,
  assertPlanPrice,
  catalogEntryForPlan,
  checkoutSubmitMessage,
  getStripe,
} from "@/lib/billing/stripeServer";
import { getServerUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Reserve =
  | { action: "create"; customer_id: string | null }
  | { action: "reuse"; url: string; customer_id: string | null }
  | { action: "manage"; customer_id: string | null }
  | { action: "busy" }
  | { action: "forbidden" };

/**
 * Starts Checkout for the signed-in user. Price, amount and customer come
 * from the server. An already active subscriber is not sold a second subscription.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!billingFormAllowed(request)) return redirectTarife();

  let plan = null as ReturnType<typeof paidPlanById>;
  try {
    plan = paidPlanById((await request.formData()).get("plan"));
  } catch {
    return redirectTarife("zahlung-fehler");
  }
  if (!plan) return redirectTarife("zahlung-fehler");

  const user = await getServerUser();
  if (!user) return redirectLoginForTariff(plan);

  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!stripe || !admin) return redirectTarife("nicht-konfiguriert");
  if (!catalogEntryForPlan(plan)) {
    return redirectTarife(plan === "pro" ? "pro-preis" : "nicht-konfiguriert");
  }

  const reserved = await admin.rpc("reserve_stripe_checkout", { p_user: user.id });
  if (reserved.error || !reserved.data || typeof reserved.data !== "object") {
    console.error("reserve_stripe_checkout failed");
    return redirectTarife("nicht-konfiguriert");
  }
  const reserve = reserved.data as Reserve;

  if (reserve.action === "busy") return redirectTarife("bitte-warten");
  if (reserve.action === "forbidden") return redirectLoginForTariff(plan);
  if (reserve.action === "manage") return redirectTarife("bereits-aktiv");
  if (reserve.action === "reuse") {
    if (isStripeRedirectUrl(reserve.url, "checkout")) {
      return NextResponse.redirect(reserve.url, 303);
    }
    return redirectTarife("zahlung-fehler");
  }

  let customerId = reserve.customer_id;
  try {
    const price = await assertPlanPrice(stripe, plan);
    const spec = PAID_PLANS[plan];
    if (!customerId) {
      const customer = await stripe.customers.create(
        newStripeCustomerParams({ userId: user.id, email: user.email }),
        { idempotencyKey: `pvn-customer-${user.id}` },
      );
      customerId = customer.id;
      const linked = await admin.rpc("link_stripe_customer", {
        p_user: user.id,
        p_customer_id: customerId,
      });
      const result =
        linked.data && typeof linked.data === "object"
          ? (linked.data as { result?: string }).result
          : null;
      if (linked.error || result !== "linked") {
        await admin.rpc("release_stripe_checkout_claim", { p_user: user.id });
        return redirectTarife("zahlung-fehler");
      }
    } else {
      await stripe.customers.update(customerId, existingStripeCustomerInvoiceParams());
    }

    const session = await stripe.checkout.sessions.create(
      initialCheckoutSession({
        userId: user.id,
        customerId,
        priceId: price.priceId,
        planKey: spec.planKey,
        label: spec.label,
        origin: getHubOrigin(),
        submitMessage: checkoutSubmitMessage(spec.priceLabel),
      }),
    );

    if (!session.url || !isStripeRedirectUrl(session.url, "checkout")) {
      await admin.rpc("release_stripe_checkout_claim", { p_user: user.id });
      return redirectTarife("zahlung-fehler");
    }
    await admin.rpc("store_stripe_checkout_session", {
      p_user: user.id,
      p_session_id: session.id,
      p_url: session.url,
      p_expires_at: new Date(session.expires_at * 1000).toISOString(),
    });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    await admin.rpc("release_stripe_checkout_claim", { p_user: user.id });
    if (error instanceof BillingNotConfiguredError) return redirectTarife("nicht-konfiguriert");
    if (error instanceof BillingPriceError) return redirectTarife("preis");
    console.error("Stripe Checkout failed", error instanceof Error ? error.name : "error");
    return redirectTarife("zahlung-fehler");
  }
}

