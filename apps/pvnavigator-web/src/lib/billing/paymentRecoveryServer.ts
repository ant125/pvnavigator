import "server-only";

import type Stripe from "stripe";

import { applyBillingEvent, resolveBillingUser } from "./applyBillingEvent";
import { finishUpgradeReplacements } from "./finishUpgradeReplacements";
import {
  CRON_CUSTOMER_BATCH,
  CRON_RECENT_CUSTOMER_SLOTS,
  CRON_SWEEP_BUDGET_MS,
  emptyCronSweep,
  selectCronCustomers,
  sweepCronCheckouts,
  type CronCustomer,
  type CronSweepSummary,
} from "./cronCheckoutRecovery";
import {
  checkoutSessionListParams,
  recoverOutstandingCheckouts,
  recoverPaidCheckout,
  type CheckoutRecoveryDeps,
  type OutstandingRecovery,
  type RecoveryResult,
} from "./paymentRecovery";
import {
  runAccountCheckoutRecovery,
  type AccountRecoveryOutcome,
  type AccountRecoveryStamp,
} from "./accountCheckoutRecovery";
import { getStripe, loadPriceCatalog, BillingPriceError } from "./stripeServer";
import { createServiceRoleClient } from "../supabase/serviceRole";

/**
 * Server entry for a paid Checkout Session. Confirmation, the account page,
 * and the daily billing cron call it. Stripe is only read here. Ending the
 * replaced subscription stays in finishUpgradeReplacements, and only after
 * the database has stored that paid upgrade.
 */

const accountRecoveryStamps = new Map<string, AccountRecoveryStamp>();

const INVOICE_LIST_PAGES = 5;

export async function recoverPaidCheckoutSession(
  userId: string,
  sessionId: string,
): Promise<RecoveryResult> {
  const deps = recoveryDeps(userId);
  if (!deps) return { status: "retry", reason: "not_configured" };
  return recoverPaidCheckout(deps, { userId, sessionId });
}

export async function recoverOutstandingCheckoutSessions(userId: string): Promise<OutstandingRecovery> {
  const deps = recoveryDeps(userId);
  if (!deps) return { status: "retry", reason: "not_configured" };
  return recoverOutstandingCheckouts(deps, { userId });
}

/**
 * Account-page sweep. Skips Stripe when this user has no customer, and does
 * not list sessions again until the interval has passed. A thrown Stripe or
 * database error becomes a retry result so the account page can still render.
 */
export async function recoverAccountCheckouts(userId: string): Promise<AccountRecoveryOutcome> {
  const admin = createServiceRoleClient();
  if (!admin) return { status: "retry", reason: "not_configured" };
  return runAccountCheckoutRecovery(
    { userId, now: Date.now() },
    {
      memory: accountRecoveryStamps,
      async readCheckout(ownerUserId) {
        const [customer, claim] = await Promise.all([
          admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", ownerUserId).maybeSingle(),
          admin.from("stripe_checkout_claims").select("session_id").eq("user_id", ownerUserId).maybeSingle(),
        ]);
        if (customer.error || claim.error) throw customer.error ?? claim.error;
        const customerId = customer.data?.stripe_customer_id;
        const sessionId = claim.data?.session_id;
        return {
          customerId: typeof customerId === "string" ? customerId : null,
          sessionId: typeof sessionId === "string" ? sessionId : null,
        };
      },
      recover: recoverOutstandingCheckoutSessions,
    },
  );
}

function recoveryDeps(userId: string): WiredDeps | null {
  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!stripe || !admin) return null;
  let catalog: CheckoutRecoveryDeps["catalog"];
  try {
    catalog = loadPriceCatalog();
  } catch (error) {
    if (error instanceof BillingPriceError) return null;
    throw error;
  }
  if (catalog.length === 0) return null;

  return {
    catalog,
    retrieveSession: (sessionId) => stripe.checkout.sessions.retrieve(sessionId),
    retrieveInvoice: (invoiceId) => stripe.invoices.retrieve(invoiceId),
    retrieveSubscription: (subscriptionId) => stripe.subscriptions.retrieve(subscriptionId),
    listSubscriptionInvoices: (subscriptionId) => listInvoices(stripe, subscriptionId),
    resolveUser: (customerId, candidateUserId) => resolveBillingUser(admin, customerId, candidateUserId),
    async periodForInvoice(invoiceId) {
      const { data, error } = await admin
        .from("subscription_periods")
        .select("user_id")
        .eq("source", "stripe")
        .eq("external_ref", invoiceId)
        .maybeSingle();
      if (error) throw error;
      const owner = data && typeof data.user_id === "string" ? data.user_id : null;
      if (!owner) return "none";
      return owner === userId ? "own" : "foreign";
    },
    async replacesOwner(ownerUserId, subscriptionId) {
      const { data, error } = await admin
        .from("stripe_subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      if (error) throw error;
      const owner = data && typeof data.user_id === "string" ? data.user_id : null;
      if (!owner) return "unknown";
      return owner === ownerUserId ? "owned" : "foreign";
    },
    apply: (args) => applyBillingEvent(admin, args),
    async finishReplacements() {
      const finished = await finishUpgradeReplacements(stripe, admin);
      return { ok: finished.ok, unresolved: finished.unresolved };
    },
    async customerIdForUser(ownerUserId) {
      const { data, error } = await admin
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("user_id", ownerUserId)
        .maybeSingle();
      if (error) throw error;
      return data && typeof data.stripe_customer_id === "string" ? data.stripe_customer_id : null;
    },
    listCheckoutSessions: (customerId) => listSessions(stripe, customerId),
  };
}

type WiredDeps = CheckoutRecoveryDeps & {
  customerIdForUser: (userId: string) => Promise<string | null>;
  listCheckoutSessions: (customerId: string) => Promise<unknown[]>;
};

async function listSessions(stripe: Stripe, customerId: string): Promise<Stripe.Checkout.Session[]> {
  const listed = await stripe.checkout.sessions.list(checkoutSessionListParams(customerId));
  return listed.data;
}

/**
 * Bounded scan of known Stripe customers. One customer's Stripe error is a
 * retry result and does not stop the batch. The scan stamp reuses updated_at
 * and does not change the customer id. Customers beyond this batch stay for
 * a later run.
 */
export async function recoverCronCheckoutBatch(now = Date.now()): Promise<CronSweepSummary> {
  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!stripe || !admin) return emptyCronSweep("not_configured");
  try {
    const catalog = loadPriceCatalog();
    if (catalog.length === 0) return emptyCronSweep("not_configured");
  } catch (error) {
    if (error instanceof BillingPriceError) return emptyCronSweep("not_configured");
    throw error;
  }

  const rows = await listCronCustomerEnds(admin);
  const selected = selectCronCustomers(rows);
  const customerIds = new Map(selected.map((row) => [row.userId, row.customerId]));
  return sweepCronCheckouts({
    customers: selected,
    deadlineAt: now + CRON_SWEEP_BUDGET_MS,
    recover: (userId) => recoverOutstandingCheckoutSessions(userId),
    async markScanned(userId) {
      const customerId = customerIds.get(userId);
      if (!customerId) return;
      const { error } = await admin
        .from("stripe_customers")
        .update({ updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("stripe_customer_id", customerId);
      if (error) throw error;
    },
  });
}

async function listCronCustomerEnds(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
): Promise<CronCustomer[]> {
  const oldest = admin
    .from("stripe_customers")
    .select("user_id, stripe_customer_id, updated_at")
    .order("updated_at", { ascending: true })
    .order("user_id", { ascending: true })
    .limit(CRON_CUSTOMER_BATCH);
  const newest = admin
    .from("stripe_customers")
    .select("user_id, stripe_customer_id, updated_at")
    .order("updated_at", { ascending: false })
    .order("user_id", { ascending: false })
    .limit(CRON_RECENT_CUSTOMER_SLOTS);
  const [older, newer] = await Promise.all([oldest, newest]);
  if (older.error || newer.error) throw older.error ?? newer.error;
  return [...readCustomerRows(older.data), ...readCustomerRows(newer.data)];
}

function readCustomerRows(data: unknown): CronCustomer[] {
  if (!Array.isArray(data)) return [];
  const rows: CronCustomer[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const record = item as {
      user_id?: unknown;
      stripe_customer_id?: unknown;
      updated_at?: unknown;
    };
    if (typeof record.user_id !== "string" || typeof record.stripe_customer_id !== "string") continue;
    rows.push({
      userId: record.user_id,
      customerId: record.stripe_customer_id,
      scannedAt: typeof record.updated_at === "string" ? record.updated_at : "",
    });
  }
  return rows;
}

/**
 * All invoices for the subscription, newest first, at most five pages.
 * The recovery then keeps the Checkout invoice. It does not read latest_invoice.
 */
async function listInvoices(stripe: Stripe, subscriptionId: string): Promise<Stripe.Invoice[]> {
  const invoices: Stripe.Invoice[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < INVOICE_LIST_PAGES; page += 1) {
    const listed = await stripe.invoices.list({
      subscription: subscriptionId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    invoices.push(...listed.data);
    if (!listed.has_more) break;
    const last = listed.data[listed.data.length - 1];
    if (!last) break;
    startingAfter = last.id;
  }
  return invoices;
}
