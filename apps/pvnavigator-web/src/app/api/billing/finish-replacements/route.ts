import { runBillingCron } from "@/lib/billing/cronCheckoutRecovery";
import { cronRequestAuthorized } from "@/lib/billing/cronAuth";
import { finishFailedRenewals } from "@/lib/billing/finishFailedRenewals";
import { finishUpgradeReplacements } from "@/lib/billing/finishUpgradeReplacements";
import { recoverCronCheckoutBatch } from "@/lib/billing/paymentRecoveryServer";
import { getStripe } from "@/lib/billing/stripeServer";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily backstop for paid checkouts whose webhook never arrived, for paid
 * upgrades whose old subscription is still open, and for failed monthly
 * renewals whose invoice is not void yet. Uses the same recovery and
 * finishers as the webhook. Vercel Cron calls this with CRON_SECRET.
 * Webhook signatures are not involved here.
 */
export async function GET(request: Request): Promise<Response> {
  if (!cronRequestAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!stripe || !admin) {
    console.error("subscription replacement follow-up is not configured");
    return new Response("Unavailable", { status: 503 });
  }

  try {
    const outcome = await runBillingCron({
      recoverCheckouts: () => recoverCronCheckoutBatch(),
      finishReplacements: () => finishUpgradeReplacements(stripe, admin),
      finishRenewals: () => finishFailedRenewals(stripe, admin),
    });
    if (outcome.status === 200 && outcome.body) return Response.json(outcome.body);
    return new Response("Retry", { status: outcome.status });
  } catch (error) {
    console.error(
      "subscription replacement follow-up failed",
      error instanceof Error ? error.name : "error",
    );
    return new Response("Retry", { status: 500 });
  }
}
