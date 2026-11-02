import { NextResponse, type NextRequest } from "next/server";
import { getHubOrigin } from "@pv-auth/session";

import { billingFormAllowed, redirectKonto, redirectLoginForKonto } from "@/lib/billing/billingHttp";
import {
  canOpenInvoiceHistory,
  resolveInvoiceHistoryConfiguration,
} from "@/lib/billing/invoicePortal";
import { isStripeRedirectUrl } from "@/lib/billing/stripeEvents";
import { getStripe } from "@/lib/billing/stripeServer";
import { getServerUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invoice history for the signed-in user's own Stripe customer.
 * A customer id from the browser is ignored. Subscription status is ignored.
 * The session uses a non-default portal configuration limited to invoices.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!billingFormAllowed(request)) return redirectKonto();
  const user = await getServerUser();
  if (!user) return redirectLoginForKonto();

  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!stripe || !admin) return redirectKonto("rechnungen-fehler");

  const [customerResult, invoiceResult] = await Promise.all([
    admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle(),
    admin.from("stripe_invoices").select("stripe_invoice_id").eq("user_id", user.id).limit(1),
  ]);
  if (customerResult.error || invoiceResult.error) {
    console.error("invoice portal lookup failed");
    return redirectKonto("rechnungen-fehler");
  }

  const customerId = customerResult.data?.stripe_customer_id;
  const invoiceCount = invoiceResult.data?.length ?? 0;
  if (typeof customerId !== "string" || !canOpenInvoiceHistory(customerId, invoiceCount)) {
    return redirectKonto("rechnungen-fehlen");
  }

  try {
    const configuration = await resolveInvoiceHistoryConfiguration(stripe);
    if (!configuration) return redirectKonto("rechnungen-fehler");
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration,
      return_url: `${getHubOrigin()}/konto`,
      locale: "de",
    });
    if (!isStripeRedirectUrl(portal.url, "portal")) return redirectKonto("rechnungen-fehler");
    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    console.error("Stripe invoice portal failed", error instanceof Error ? error.name : "error");
    return redirectKonto("rechnungen-fehler");
  }
}
