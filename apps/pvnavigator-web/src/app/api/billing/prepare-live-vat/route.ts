import { cronRequestAuthorized } from "@/lib/billing/cronAuth";
import { paidBillingPaused } from "@/lib/billing/publicBilling";
import { prepareLiveVat } from "@/lib/billing/prepareLiveVat";
import { getStripe, stripeRuntimeMode } from "@/lib/billing/stripeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prepares live net prices and German Stripe Tax. Cron-secret protected.
 * Does not start a payment and does not change an existing subscription.
 */
export async function POST(request: Request): Promise<Response> {
  if (!cronRequestAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (paidBillingPaused()) return new Response("Paid billing is paused", { status: 409 });
  if (stripeRuntimeMode() !== "live") return new Response("Live mode required", { status: 409 });
  const stripe = getStripe();
  if (!stripe) return new Response("Unavailable", { status: 503 });
  try {
    const report = await prepareLiveVat(stripe);
    return Response.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "error";
    console.error("prepare live vat failed", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
