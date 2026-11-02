/**
 * Ends the ABO subscription after the PRO invoice has opened its period.
 * No proration and no closing invoice. A schedule is canceled with the
 * subscription so a later phase cannot charge.
 */

export const REPLACEMENT_CANCEL_PARAMS = { invoice_now: false, prorate: false } as const;

export type ReplacementTarget =
  | { action: "none" }
  | { action: "cancel_schedule"; id: string }
  | { action: "cancel_subscription"; id: string };

export function replacementCancelTarget(subscription: {
  status: string;
  scheduleId: string | null;
  id: string;
}): ReplacementTarget {
  if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
    return { action: "none" };
  }
  if (subscription.scheduleId) return { action: "cancel_schedule", id: subscription.scheduleId };
  return { action: "cancel_subscription", id: subscription.id };
}

export function replacementAlreadyEnded(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return (error as { code?: unknown }).code === "resource_missing";
}

export type PendingReplacement = {
  invoiceId: string;
  replacesSubscriptionId: string;
  customerId: string | null;
  /**
   * The cancellation is already recorded. Only the local subscription status
   * still needs to become canceled. Stripe is not asked to cancel again.
   */
  statusSyncOnly?: boolean;
};

export type LoadedSubscription = {
  id: string;
  status: string;
  scheduleId: string | null;
  customerId: string;
};

export type FinishReplacementsResult = {
  /** False when Stripe failed temporarily. Those rows stay pending for another attempt. */
  ok: boolean;
  /** Paid upgrades whose customer id did not match. They stay pending and are not canceled. */
  unresolved: number;
  /** Replacements marked complete during this call. */
  finished: number;
};

/**
 * Cancels every stored replacement. A Stripe error leaves that row pending
 * and the loop continues with the next row, so one customer cannot block the
 * others. A customer-id mismatch is left pending: the subscription is not
 * canceled and replacement_finished_at is not set. Already canceled
 * subscriptions and missing subscriptions are finished. Cancel always uses
 * invoice_now false and prorate false.
 */
export async function finishPendingSubscriptionReplacements(args: {
  pending: PendingReplacement[];
  load: (subscriptionId: string) => Promise<LoadedSubscription>;
  cancelSubscription: (subscriptionId: string) => Promise<void>;
  cancelSchedule: (scheduleId: string) => Promise<void>;
  complete: (invoiceId: string) => Promise<void>;
  onBlocked?: (invoiceId: string, reason: "customer_mismatch" | "stripe_error" | "status_sync") => void;
}): Promise<FinishReplacementsResult> {
  let unresolved = 0;
  let finished = 0;
  let ok = true;
  for (const row of args.pending) {
    if (row.statusSyncOnly) {
      try {
        await args.complete(row.invoiceId);
        finished += 1;
      } catch {
        args.onBlocked?.(row.invoiceId, "status_sync");
        ok = false;
      }
      continue;
    }
    let loaded: LoadedSubscription;
    try {
      loaded = await args.load(row.replacesSubscriptionId);
    } catch (error) {
      if (replacementAlreadyEnded(error)) {
        await args.complete(row.invoiceId);
        finished += 1;
        continue;
      }
      args.onBlocked?.(row.invoiceId, "stripe_error");
      ok = false;
      continue;
    }
    if (!row.customerId || loaded.customerId !== row.customerId) {
      unresolved += 1;
      args.onBlocked?.(row.invoiceId, "customer_mismatch");
      continue;
    }
    const target = replacementCancelTarget(loaded);
    try {
      if (target.action === "cancel_schedule") await args.cancelSchedule(target.id);
      if (target.action === "cancel_subscription") await args.cancelSubscription(target.id);
    } catch (error) {
      if (!replacementAlreadyEnded(error)) {
        args.onBlocked?.(row.invoiceId, "stripe_error");
        ok = false;
        continue;
      }
    }
    await args.complete(row.invoiceId);
    finished += 1;
  }
  return { ok, unresolved, finished };
}
