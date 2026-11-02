/**
 * Recovers a paid Checkout Session when invoice.paid never arrived.
 * Access is granted only by normalizePaidInvoice and applyBillingEvent.
 * A Checkout payment_status of paid is not enough. The finisher ends an
 * old subscription only after the database has stored that upgrade.
 *
 * stripe_checkout_claims keeps one session per user and overwrites it.
 * Discovery lists Checkout Sessions for the linked Stripe customer instead,
 * so a paid session remains reachable after a later checkout. No schema
 * change is required for that. Without a stripe_customers row there is no
 * customer id to search; a caller who already has the session id can still
 * recover it. Checkout links the customer before it creates the session.
 * The search reads the newest CHECKOUT_RECOVERY_SESSION_LIMIT Checkout
 * Sessions with status complete. Open and expired sessions do not use that
 * window. A paid complete session older than that page is not discovered:
 * the next run starts again at the newest page, and this database has no
 * per-session cursor. stripe_checkout_claims cannot fill that gap because
 * it keeps one session per user and overwrites it. The later schema, if the
 * bound is too small, is one row per Checkout Session (session id, user id,
 * stripe customer id) written when Checkout is created.
 */

import {
  invoiceSubscriptionId,
  isBillingUserId,
  normalizePaidInvoice,
  type AllowedPrice,
  type BillingCommand,
} from "./stripeEvents";

export const CHECKOUT_RECOVERY_SESSION_LIMIT = 100;

export type RecoveryRefusal =
  | "session_id"
  | "session_shape"
  | "session_mismatch"
  | "livemode"
  | "session_user"
  | "session_user_mismatch"
  | "not_subscription"
  | "customer_mismatch"
  | "subscription_mismatch"
  | "subscription_customer"
  | "subscription_user"
  | "invoice_shape"
  | "invoice_subscription"
  | "invoice_customer"
  | "invoice_ambiguous"
  | "not_checkout_invoice"
  | "unpaid_invoice"
  | "amount_mismatch"
  | "currency"
  | "billing_interval"
  | "payment_mismatch"
  | "replaces_foreign"
  | "replaces_self"
  | "foreign_period"
  | "not_granted"
  | "already_recorded";

export type RecoveryRetryReason =
  | "unavailable"
  | "database"
  | "session_incomplete"
  | "subscription_not_ready"
  | "invoice_not_ready"
  | "invoice_lines"
  | "user_missing"
  | "not_configured";

export type RecoveryResult =
  | {
      status: "granted" | "already_granted";
      invoiceId: string;
      subscriptionId: string;
      replacementPending: boolean;
    }
  | { status: "unpaid" }
  | { status: "refused"; reason: RecoveryRefusal }
  | { status: "retry"; reason: RecoveryRetryReason };

export type OutstandingRecovery =
  | { status: "done"; examined: number; results: RecoveryResult[] }
  | { status: "skipped"; reason: "no_customer" | "session_user" }
  | { status: "retry"; reason: RecoveryRetryReason };

/** Stripe list parameters for one customer's newest complete Checkout Sessions. */
export function checkoutSessionListParams(customerId: string): {
  customer: string;
  status: "complete";
  limit: number;
} {
  return {
    customer: customerId,
    status: "complete",
    limit: CHECKOUT_RECOVERY_SESSION_LIMIT,
  };
}

export type CheckoutRecoveryDeps = {
  /** Stripe mode of this server. Session, subscription and invoice must match it. */
  livemode: boolean;
  catalog: readonly AllowedPrice[];
  retrieveSession: (sessionId: string) => Promise<unknown>;
  retrieveInvoice: (invoiceId: string) => Promise<unknown>;
  retrieveSubscription: (subscriptionId: string) => Promise<unknown>;
  /** Invoices for this subscription. The caller must not substitute latest_invoice. */
  listSubscriptionInvoices: (subscriptionId: string) => Promise<unknown[]>;
  resolveUser: (
    customerId: string | null,
    candidateUserId: string | null,
  ) => Promise<{ userId: string } | { mismatch: true } | { missing: true }>;
  periodForInvoice: (invoiceId: string) => Promise<"none" | "own" | "foreign">;
  replacesOwner: (userId: string, subscriptionId: string) => Promise<"owned" | "foreign" | "unknown">;
  apply: (args: {
    eventId: string;
    eventType: string;
    livemode: boolean;
    command: BillingCommand;
  }) => Promise<{ ok: true; outcome: string } | { ok: false }>;
  finishReplacements: () => Promise<{ ok: boolean; unresolved?: number }>;
};

type PaidCommand = Extract<BillingCommand, { action: "invoice_paid" }>;

/** Stable id for this invoice. A later webhook keeps its own evt_ id. */
export function recoveryEventId(invoiceId: string): string {
  return `invoice:${invoiceId}`;
}

/**
 * Applies one paid Checkout Session through the existing billing command.
 * Safe to call more than once, and safe when the webhook applies the same
 * invoice under a different event id: the period is keyed by the invoice.
 */
export async function recoverPaidCheckout(
  deps: CheckoutRecoveryDeps,
  input: { userId: string; sessionId: string },
): Promise<RecoveryResult> {
  try {
    const prepared = await preparePaidCheckout(deps, input);
    if (!prepared.ok) return prepared.result;
    const command = prepared.command;
    const period = await deps.periodForInvoice(command.invoiceId);
    if (period === "foreign") return refused("foreign_period");
    if (period === "own") return finishGranted(deps, "already_granted", command);

    const applied = await deps.apply({
      eventId: recoveryEventId(command.invoiceId),
      eventType: "invoice.paid",
      livemode: deps.livemode,
      command,
    });
    if (!applied.ok) return { status: "retry", reason: "database" };
    if (applied.outcome === "ignored") return refused("not_granted");
    if (applied.outcome === "duplicate") {
      const again = await deps.periodForInvoice(command.invoiceId);
      if (again === "foreign") return refused("foreign_period");
      if (again !== "own") return refused("already_recorded");
      return finishGranted(deps, "already_granted", command);
    }
    if (applied.outcome !== "processed") return refused("not_granted");
    return finishGranted(deps, "granted", command);
  } catch (error) {
    console.error("checkout recovery unavailable", error instanceof Error ? error.name : "error");
    return { status: "retry", reason: "unavailable" };
  }
}

/**
 * Paid sessions for this user, including one that the single claim row has
 * already overwritten. Does not read stripe_checkout_claims.
 */
export async function recoverOutstandingCheckouts(
  deps: CheckoutRecoveryDeps & {
    customerIdForUser: (userId: string) => Promise<string | null>;
    listCheckoutSessions: (customerId: string) => Promise<unknown[]>;
  },
  input: { userId: string },
): Promise<OutstandingRecovery> {
  if (!isBillingUserId(input.userId)) return { status: "skipped", reason: "session_user" };
  try {
    const customerId = await deps.customerIdForUser(input.userId);
    if (!customerId) return { status: "skipped", reason: "no_customer" };
    const listed = await deps.listCheckoutSessions(customerId);
    const results: RecoveryResult[] = [];
    const seen = new Set<string>();
    let examined = 0;
    for (const item of listed.slice(0, CHECKOUT_RECOVERY_SESSION_LIMIT)) {
      if (!isRecord(item)) continue;
      const sessionId = idOf(item.id);
      if (!sessionId || seen.has(sessionId) || !sessionId.startsWith("cs_")) continue;
      seen.add(sessionId);
      examined += 1;
      if (item.payment_status !== "paid") continue;
      if (item.client_reference_id !== input.userId) continue;
      results.push(await recoverPaidCheckout(deps, { userId: input.userId, sessionId }));
    }
    return { status: "done", examined, results };
  } catch (error) {
    console.error("checkout recovery unavailable", error instanceof Error ? error.name : "error");
    return { status: "retry", reason: "unavailable" };
  }
}

async function preparePaidCheckout(
  deps: CheckoutRecoveryDeps,
  input: { userId: string; sessionId: string },
): Promise<{ ok: true; command: PaidCommand } | { ok: false; result: RecoveryResult }> {
  if (!isBillingUserId(input.userId)) return stop(refused("session_user"));
  if (!input.sessionId.startsWith("cs_")) return stop(refused("session_id"));
  if (deps.catalog.length === 0) return stop({ status: "retry", reason: "not_configured" });

  const session = await deps.retrieveSession(input.sessionId);
  if (!isRecord(session)) return stop(refused("session_shape"));
  if (idOf(session.id) !== input.sessionId) return stop(refused("session_mismatch"));
  if (session.livemode !== deps.livemode) return stop(refused("livemode"));
  if (session.mode !== "subscription") return stop(refused("not_subscription"));

  const metadata = isRecord(session.metadata) ? session.metadata : null;
  const reference = session.client_reference_id;
  const metaUser = metadata?.user_id;
  if (typeof reference !== "string" || reference.trim() !== input.userId) return stop(refused("session_user"));
  if (metaUser !== undefined && metaUser !== null && metaUser !== input.userId) {
    return stop(refused("session_user_mismatch"));
  }
  if (session.payment_status !== "paid") return stop({ status: "unpaid" });
  if (session.status !== "complete") return stop({ status: "retry", reason: "session_incomplete" });

  const customerId = idOf(session.customer);
  if (!customerId) return stop({ status: "retry", reason: "session_incomplete" });
  const resolved = await deps.resolveUser(customerId, input.userId);
  if ("mismatch" in resolved) return stop(refused("customer_mismatch"));
  if ("missing" in resolved) return stop({ status: "retry", reason: "user_missing" });
  if (resolved.userId !== input.userId) return stop(refused("customer_mismatch"));

  const subscriptionId = idOf(session.subscription);
  if (!subscriptionId || !subscriptionId.startsWith("sub_")) {
    return stop({ status: "retry", reason: "subscription_not_ready" });
  }
  const subscription = await deps.retrieveSubscription(subscriptionId);
  if (!isRecord(subscription) || idOf(subscription.id) !== subscriptionId) {
    return stop(refused("subscription_mismatch"));
  }
  if (subscription.livemode !== deps.livemode) return stop(refused("livemode"));
  if (idOf(subscription.customer) !== customerId) return stop(refused("subscription_customer"));
  const subscriptionUser = isRecord(subscription.metadata) ? subscription.metadata.user_id : null;
  if (subscriptionUser !== undefined && subscriptionUser !== null && subscriptionUser !== input.userId) {
    return stop(refused("subscription_user"));
  }

  const invoice = await resolveCheckoutInvoice(deps, session, subscriptionId, customerId);
  if (!invoice.ok) return invoice;
  const paid = paidInvoiceRecord(session, invoice.invoice);
  if (!paid.ok) return paid;

  const normalized = normalizePaidInvoice(invoice.invoice, deps.catalog, input.userId);
  if (normalized.status === "incomplete") return stop({ status: "retry", reason: "invoice_lines" });
  if (normalized.command.action !== "invoice_paid") return stop(refused("invoice_shape"));
  const command = normalized.command;
  if (
    command.invoiceId !== idOf(invoice.invoice.id) ||
    command.subscriptionId !== subscriptionId ||
    command.userId !== input.userId ||
    command.customerId !== customerId
  ) {
    return stop(refused("invoice_shape"));
  }

  const replaces = command.replacesSubscriptionId;
  if (replaces) {
    if (replaces === subscriptionId) return stop(refused("replaces_self"));
    const owner = await deps.replacesOwner(input.userId, replaces);
    if (owner === "foreign") return stop(refused("replaces_foreign"));
  }
  return { ok: true, command };
}

/**
 * The invoice created for this Checkout payment. session.invoice wins.
 * Otherwise the single subscription_create invoice for this subscription.
 * A later latest_invoice is never selected.
 */
async function resolveCheckoutInvoice(
  deps: CheckoutRecoveryDeps,
  session: Record<string, unknown>,
  subscriptionId: string,
  customerId: string,
): Promise<{ ok: true; invoice: Record<string, unknown> } | { ok: false; result: RecoveryResult }> {
  const directId = idOf(session.invoice);
  let invoiceId = directId;
  if (!invoiceId) {
    const listed = await deps.listSubscriptionInvoices(subscriptionId);
    const ids: string[] = [];
    for (const item of listed) {
      if (!isRecord(item) || item.billing_reason !== "subscription_create" || item.livemode !== deps.livemode) continue;
      if (invoiceSubscriptionId(item) !== subscriptionId || idOf(item.customer) !== customerId) continue;
      const id = idOf(item.id);
      if (id?.startsWith("in_") && !ids.includes(id)) ids.push(id);
    }
    if (ids.length === 0) return stop({ status: "retry", reason: "invoice_not_ready" });
    if (ids.length > 1) return stop(refused("invoice_ambiguous"));
    invoiceId = ids[0] ?? null;
  }
  if (!invoiceId || !invoiceId.startsWith("in_")) return stop(refused("invoice_shape"));

  const loaded = await deps.retrieveInvoice(invoiceId);
  if (!isRecord(loaded) || idOf(loaded.id) !== invoiceId) return stop(refused("invoice_shape"));
  if (loaded.livemode !== deps.livemode) return stop(refused("livemode"));
  if (invoiceSubscriptionId(loaded) !== subscriptionId) return stop(refused("invoice_subscription"));
  if (idOf(loaded.customer) !== customerId) return stop(refused("invoice_customer"));
  if (loaded.billing_reason !== "subscription_create") return stop(refused("not_checkout_invoice"));
  return { ok: true, invoice: loaded };
}

function paidInvoiceRecord(
  session: Record<string, unknown>,
  invoice: Record<string, unknown>,
): { ok: true } | { ok: false; result: RecoveryResult } {
  const amount = invoice.amount_paid;
  if (invoice.status !== "paid" || typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return stop(refused("unpaid_invoice"));
  }
  const invoiceCurrency = currencyOf(invoice.currency);
  const sessionCurrency = currencyOf(session.currency);
  if (invoiceCurrency !== "eur" || (sessionCurrency !== null && sessionCurrency !== "eur")) {
    return stop(refused("currency"));
  }
  if (typeof session.amount_total === "number" && session.amount_total !== amount) {
    return stop(refused("amount_mismatch"));
  }
  if (!monthlyInterval(invoice)) return stop(refused("billing_interval"));
  const sessionPayment = idOf(session.payment_intent);
  const invoicePayment = idOf(invoice.payment_intent);
  if (sessionPayment && invoicePayment && sessionPayment !== invoicePayment) {
    return stop(refused("payment_mismatch"));
  }
  return { ok: true };
}

async function finishGranted(
  deps: CheckoutRecoveryDeps,
  status: "granted" | "already_granted",
  command: PaidCommand,
): Promise<RecoveryResult> {
  let replacementPending = true;
  try {
    const finished = await deps.finishReplacements();
    replacementPending = !finished.ok || (finished.unresolved ?? 0) > 0;
  } catch (error) {
    console.error("checkout recovery replacement pending", error instanceof Error ? error.name : "error");
  }
  return {
    status,
    invoiceId: command.invoiceId,
    subscriptionId: command.subscriptionId,
    replacementPending,
  };
}

function monthlyInterval(invoice: Record<string, unknown>): boolean {
  for (const line of asList(invoice.lines)) {
    if (isProration(line)) continue;
    const recurring = lineRecurring(line);
    if (!recurring) continue;
    if (recurring.interval !== "month" || recurring.count !== 1) return false;
  }
  return true;
}

function lineRecurring(line: Record<string, unknown>): { interval: string; count: number } | null {
  const pricing = isRecord(line.pricing) ? line.pricing : null;
  const details = pricing && isRecord(pricing.price_details) ? pricing.price_details : null;
  const nested = details && isRecord(details.price) ? details.price.recurring : null;
  const direct = isRecord(line.price) ? line.price.recurring : null;
  for (const recurring of [nested, direct]) {
    if (!isRecord(recurring) || typeof recurring.interval !== "string") continue;
    const count = recurring.interval_count;
    return { interval: recurring.interval, count: typeof count === "number" ? count : 1 };
  }
  return null;
}

function isProration(line: Record<string, unknown>): boolean {
  const parent = isRecord(line.parent) ? line.parent : null;
  const details = parent && isRecord(parent.subscription_item_details) ? parent.subscription_item_details : null;
  return details?.proration === true;
}

function currencyOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function asList(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];
  return value.data.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isRecord(value) && typeof value.id === "string" && value.id.trim()) return value.id.trim();
  return null;
}

function refused(reason: RecoveryRefusal): RecoveryResult {
  return { status: "refused", reason };
}

function stop(result: RecoveryResult): { ok: false; result: RecoveryResult } {
  return { ok: false, result };
}
