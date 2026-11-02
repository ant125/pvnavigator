import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerUser } from "@/lib/auth";
import { recoverPaidCheckoutSession } from "@/lib/billing/paymentRecoveryServer";
import type { RecoveryResult } from "@/lib/billing/paymentRecovery";
import { getStripe } from "@/lib/billing/stripeServer";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNERSHIP_REFUSALS = new Set([
  "session_user",
  "session_user_mismatch",
  "customer_mismatch",
  "foreign_period",
  "session_mismatch",
  "subscription_customer",
  "subscription_user",
  "invoice_customer",
]);

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }
  return null;
}

function unavailable(): Response {
  return Response.json({ state: "unavailable" }, { status: 503 });
}

function forbidden(): Response {
  return Response.json({ state: "forbidden" }, { status: 403 });
}

function sessionMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : null;
  const statusCode = "statusCode" in error ? (error as { statusCode?: unknown }).statusCode : null;
  return code === "resource_missing" || statusCode === 404;
}

type PeriodRow = { id: string; period_end: string; plan_key: string };

async function readPeriod(
  admin: SupabaseClient,
  userId: string,
  invoiceId: string,
): Promise<{ row: PeriodRow | null; error: boolean }> {
  const { data, error } = await admin
    .from("subscription_periods")
    .select("id, period_end, plan_key")
    .eq("user_id", userId)
    .eq("source", "stripe")
    .eq("external_ref", invoiceId)
    .maybeSingle();
  if (error) return { row: null, error: true };
  const row = data as PeriodRow | null;
  return { row, error: false };
}

function active(row: PeriodRow): Response {
  return Response.json({
    state: "active",
    periodEnd: row.period_end,
    planKey: row.plan_key,
  });
}

/**
 * Confirms a Checkout Session for the signed-in user. A paid Stripe status
 * does not grant access. When the paid period is missing, the shared recovery
 * verifies the invoice and applies the existing billing command. The tariff
 * shown afterwards is the plan key stored on that period.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getServerUser();
  if (!user) return Response.json({ state: "unauthenticated" }, { status: 401 });

  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim() ?? "";
  if (!sessionId.startsWith("cs_")) return forbidden();

  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!stripe || !admin) return unavailable();

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if (sessionMissing(error)) return forbidden();
    return unavailable();
  }

  const reference = session.client_reference_id;
  const metadataUser =
    session.metadata && typeof session.metadata.user_id === "string" ? session.metadata.user_id : null;
  if (reference !== user.id && metadataUser !== user.id) return forbidden();

  if (session.payment_status !== "paid") {
    return Response.json({ state: "unpaid" });
  }

  const invoiceId = idOf(session.invoice);
  if (invoiceId) {
    const existing = await readPeriod(admin, user.id, invoiceId);
    if (existing.error) return unavailable();
    if (existing.row) return active(existing.row);
  }

  const recovered = await recoverPaidCheckoutSession(user.id, sessionId);
  return responseForRecovery(admin, user.id, recovered);
}

async function responseForRecovery(
  admin: SupabaseClient,
  userId: string,
  recovered: RecoveryResult,
): Promise<Response> {
  if (recovered.status === "granted" || recovered.status === "already_granted") {
    const period = await readPeriod(admin, userId, recovered.invoiceId);
    if (period.error || !period.row) return unavailable();
    return active(period.row);
  }
  if (recovered.status === "unpaid") return Response.json({ state: "unpaid" });
  if (recovered.status === "retry") {
    const down =
      recovered.reason === "unavailable" ||
      recovered.reason === "database" ||
      recovered.reason === "not_configured";
    return down ? unavailable() : Response.json({ state: "pending" }, { status: 503 });
  }
  if (recovered.status === "refused" && OWNERSHIP_REFUSALS.has(recovered.reason)) return forbidden();
  return Response.json({ state: "unpaid" });
}
