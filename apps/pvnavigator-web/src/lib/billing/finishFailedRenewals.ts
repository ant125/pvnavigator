import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import {
  RENEWAL_CANCEL_PARAMS,
  finishFailedRenewalInvoices,
  isRenewalFailureInvoice,
  type FailedRenewalInvoice,
  type RenewalFinishResult,
} from "./failedRenewal";
import { replacementAlreadyEnded } from "./upgradeReplacement";

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }
  return null;
}

/**
 * Closes failed monthly renewals. Safe to repeat after a duplicate webhook:
 * a paid or void invoice leaves the queue, and a second cancel is a no-op.
 * This does not open a subscription period and does not move the billing anchor.
 */
export async function finishFailedRenewals(
  stripe: Stripe,
  admin: SupabaseClient,
): Promise<RenewalFinishResult> {
  const listed = await admin
    .from("stripe_invoices")
    .select(
      "stripe_invoice_id, stripe_subscription_id, stripe_customer_id, status, billing_reason, subscription_period_id",
    )
    .eq("status", "payment_failed")
    .eq("billing_reason", "subscription_cycle")
    .is("subscription_period_id", null);
  if (listed.error) {
    console.error("failed renewal list failed");
    return { ok: false };
  }

  const pending: FailedRenewalInvoice[] = [];
  if (Array.isArray(listed.data)) {
    for (const row of listed.data) {
      if (!row || typeof row !== "object") continue;
      const record = row as {
        stripe_invoice_id?: unknown;
        stripe_subscription_id?: unknown;
        stripe_customer_id?: unknown;
        status?: unknown;
        billing_reason?: unknown;
        subscription_period_id?: unknown;
      };
      const invoiceId = typeof record.stripe_invoice_id === "string" ? record.stripe_invoice_id : "";
      const status = typeof record.status === "string" ? record.status : null;
      const billingReason = typeof record.billing_reason === "string" ? record.billing_reason : null;
      const subscriptionPeriodId =
        typeof record.subscription_period_id === "string" ? record.subscription_period_id : null;
      if (!isRenewalFailureInvoice({ status, billingReason, subscriptionPeriodId })) continue;
      pending.push({
        invoiceId,
        subscriptionId:
          typeof record.stripe_subscription_id === "string" ? record.stripe_subscription_id : null,
        customerId: typeof record.stripe_customer_id === "string" ? record.stripe_customer_id : null,
        billingReason,
        status,
        subscriptionPeriodId,
      });
    }
  }

  return finishFailedRenewalInvoices({
    pending,
    onBlocked(invoiceId, reason) {
      console.error("failed renewal not finished", reason, invoiceId);
    },
    async loadInvoice(invoiceId) {
      try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        return { status: invoice.status ?? "" };
      } catch (error) {
        if (replacementAlreadyEnded(error)) return { status: "void" };
        throw error;
      }
    },
    async voidInvoice(invoiceId) {
      await stripe.invoices.voidInvoice(invoiceId);
    },
    async loadSubscription(subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return {
        id: subscription.id,
        status: subscription.status,
        scheduleId: idOf(subscription.schedule),
        customerId: idOf(subscription.customer) ?? "",
      };
    },
    async cancelSubscription(subscriptionId) {
      await stripe.subscriptions.cancel(subscriptionId, RENEWAL_CANCEL_PARAMS);
    },
    async cancelSchedule(scheduleId) {
      await stripe.subscriptionSchedules.cancel(scheduleId, RENEWAL_CANCEL_PARAMS);
    },
    async settlePaid(row) {
      const done = await admin
        .from("stripe_invoices")
        .update({ status: "paid" })
        .eq("stripe_invoice_id", row.invoiceId)
        .eq("status", "payment_failed")
        .is("subscription_period_id", null);
      if (done.error) throw done.error;
    },
    async settleVoid(row) {
      if (row.subscriptionId) {
        const observedAt = Math.floor(Date.now() / 1000);
        const closed = await admin
          .from("stripe_subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: false,
            scheduled_plan_key: null,
            scheduled_effective_at: null,
            status_event_created: observedAt,
          })
          .eq("stripe_subscription_id", row.subscriptionId)
          .lt("status_event_created", observedAt)
          .select("stripe_subscription_id");
        if (closed.error) throw closed.error;
        if (!closed.data?.length) {
          const existing = await admin
            .from("stripe_subscriptions")
            .select("status")
            .eq("stripe_subscription_id", row.subscriptionId)
            .maybeSingle();
          if (existing.error) throw existing.error;
          if (existing.data && existing.data.status !== "canceled") {
            throw new Error("renewal subscription was not closed");
          }
        }
      }
      const done = await admin
        .from("stripe_invoices")
        .update({ status: "void" })
        .eq("stripe_invoice_id", row.invoiceId)
        .eq("status", "payment_failed")
        .is("subscription_period_id", null);
      if (done.error) throw done.error;
    },
  });
}
