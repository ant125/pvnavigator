import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { commandPayload, isBillingUserId, type BillingCommand } from "./stripeEvents";

export type ApplyResult = { ok: true; outcome: string } | { ok: false };

/**
 * Persists one verified event. A database error is a retry: the event row
 * and the access change commit together, so nothing is half-applied.
 */
export async function applyBillingEvent(
  admin: SupabaseClient,
  args: { eventId: string; eventType: string; livemode: boolean; command: BillingCommand },
): Promise<ApplyResult> {
  const { data, error } = await admin.rpc("apply_stripe_billing_event", {
    p_event_id: args.eventId,
    p_event_type: args.eventType,
    p_livemode: args.livemode,
    p_payload: commandPayload(args.command),
  });
  if (error) {
    console.error("apply_stripe_billing_event failed", args.eventId, args.eventType);
    return { ok: false };
  }
  const outcome =
    data && typeof data === "object" && typeof (data as { outcome?: unknown }).outcome === "string"
      ? (data as { outcome: string }).outcome
      : "processed";
  return { ok: true, outcome };
}

export async function resolveBillingUser(
  admin: SupabaseClient,
  customerId: string | null,
  candidateUserId: string | null,
): Promise<{ userId: string } | { mismatch: true } | { missing: true }> {
  if (customerId) {
    const { data, error } = await admin
      .from("stripe_customers")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    const owner = data && typeof data.user_id === "string" ? data.user_id : null;
    if (owner) {
      if (candidateUserId && candidateUserId !== owner) return { mismatch: true };
      return { userId: owner };
    }
  }
  if (candidateUserId && isBillingUserId(candidateUserId)) return { userId: candidateUserId };
  return { missing: true };
}
