import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import {
  REPLACEMENT_CANCEL_PARAMS,
  finishPendingSubscriptionReplacements,
  type FinishReplacementsResult,
  type PendingReplacement,
} from "./upgradeReplacement";

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }
  return null;
}

/**
 * Retries ending subscriptions named by paid upgrade invoices.
 * A finished replacement whose local status is still open is synchronized
 * without asking Stripe to cancel again. A database failure leaves that row
 * listed for the next run.
 */
export async function finishUpgradeReplacements(
  stripe: Stripe,
  admin: SupabaseClient,
): Promise<FinishReplacementsResult> {
  const listed = await admin.rpc("list_pending_subscription_replacements");
  if (listed.error) {
    console.error("subscription replacement list failed");
    return { ok: false, unresolved: 0, finished: 0 };
  }
  const pending: PendingReplacement[] = [];
  if (Array.isArray(listed.data)) {
    for (const row of listed.data) {
      if (!row || typeof row !== "object") continue;
      const invoiceId = (row as { stripe_invoice_id?: unknown }).stripe_invoice_id;
      const replaces = (row as { replaces_subscription_id?: unknown }).replaces_subscription_id;
      const customerId = (row as { stripe_customer_id?: unknown }).stripe_customer_id;
      const statusSyncOnly = (row as { status_sync_only?: unknown }).status_sync_only === true;
      if (typeof invoiceId !== "string" || typeof replaces !== "string") continue;
      pending.push({
        invoiceId,
        replacesSubscriptionId: replaces,
        customerId: typeof customerId === "string" ? customerId : null,
        statusSyncOnly,
      });
    }
  }

  return finishPendingSubscriptionReplacements({
    pending,
    onBlocked(invoiceId, reason) {
      console.error("subscription replacement not finished", reason, invoiceId);
    },
    async load(subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return {
        id: subscription.id,
        status: subscription.status,
        scheduleId: idOf(subscription.schedule),
        customerId: idOf(subscription.customer) ?? "",
      };
    },
    async cancelSubscription(subscriptionId) {
      await stripe.subscriptions.cancel(subscriptionId, REPLACEMENT_CANCEL_PARAMS);
    },
    async cancelSchedule(scheduleId) {
      await stripe.subscriptionSchedules.cancel(scheduleId, REPLACEMENT_CANCEL_PARAMS);
    },
    async complete(invoiceId) {
      const done = await admin.rpc("complete_subscription_replacement", { p_invoice_id: invoiceId });
      if (done.error) throw done.error;
    },
  });
}
