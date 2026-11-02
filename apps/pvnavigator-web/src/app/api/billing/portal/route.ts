import { NextResponse, type NextRequest } from "next/server";
import { getHubOrigin } from "@pv-auth/session";

import { billingFormAllowed, redirectLoginForTariff, redirectTarife } from "@/lib/billing/billingHttp";
import { isStripeRedirectUrl } from "@/lib/billing/stripeEvents";
import { getStripe } from "@/lib/billing/stripeServer";
import {
  canOpenBillingPortal,
  pickStripeSubscription,
  STRIPE_SUBSCRIPTION_SELECT,
  SUBSCRIPTION_PERIOD_SELECT,
  summarizeAccess,
  type StripeSubscriptionRow,
  type SubscriptionPeriodRow,
} from "@/lib/accessSummary";
import { getServerUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Customer Portal for the signed-in user's own Stripe customer.
 * A customer id from the browser is ignored. A stored customer alone does
 * not open the portal; the same rule as the account card must allow it.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!billingFormAllowed(request)) return redirectTarife();
  const user = await getServerUser();
  if (!user) return redirectLoginForTariff();

  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!stripe || !admin) return redirectTarife("nicht-konfiguriert");

  const [customerResult, periodsResult, billingResult] = await Promise.all([
    admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle(),
    admin.from("subscription_periods").select(SUBSCRIPTION_PERIOD_SELECT).eq("user_id", user.id),
    admin.from("stripe_subscriptions").select(STRIPE_SUBSCRIPTION_SELECT).eq("user_id", user.id),
  ]);
  if (customerResult.error || periodsResult.error || billingResult.error) {
    console.error("stripe portal lookup failed");
    return redirectTarife("zahlung-fehler");
  }
  const customerId = customerResult.data?.stripe_customer_id;
  if (typeof customerId !== "string" || !customerId) return redirectTarife("portal-fehlt");

  const summary = summarizeAccess({
    now: new Date(),
    periods: (periodsResult.data ?? []) as SubscriptionPeriodRow[],
    usedAddressesByPeriod: {},
    freeAddress: null,
    billing: pickStripeSubscription((billingResult.data ?? []) as StripeSubscriptionRow[]),
    canManagePortal: true,
  });
  if (!canOpenBillingPortal(summary)) return redirectTarife("portal-fehlt");

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getHubOrigin()}/konto`,
      locale: "de",
    });
    if (!isStripeRedirectUrl(portal.url, "portal")) return redirectTarife("zahlung-fehler");
    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    console.error("Stripe portal failed", error instanceof Error ? error.name : "error");
    return redirectTarife("zahlung-fehler");
  }
}
