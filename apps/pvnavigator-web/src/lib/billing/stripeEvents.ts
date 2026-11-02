/**
 * Turns a verified Stripe event object (API 2026-09-30.endive, stripe@23)
 * into a billing command. Period bounds come only from the invoice line's
 * service period, never from "now + 30 days". This module does not grant
 * access; the database does, and only when the invoice matches an allowed
 * price, currency and subscription. A matching amount by itself is not enough.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const STRIPE_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;

export type StripeSubscriptionStatus = (typeof STRIPE_SUBSCRIPTION_STATUSES)[number];

/** Server catalog entry. Price IDs come from the environment, never from the browser. */
export type AllowedPrice = {
  priceId: string;
  amount: number;
  currency: string;
  planKey: string;
  addressLimit: number;
};

export type BillingCommand =
  | { action: "ignore"; reason: string }
  | { action: "link_customer"; userId: string; customerId: string }
  | {
      action: "sync_subscription";
      userId: string;
      customerId: string;
      subscriptionId: string;
      status: StripeSubscriptionStatus;
      cancelAtPeriodEnd: boolean;
      cancelAt: string | null;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
      priceId: string | null;
      latestInvoiceId: string | null;
      eventCreated: number;
    }
  | {
      action: "invoice_paid";
      userId: string;
      customerId: string;
      subscriptionId: string;
      invoiceId: string;
      billingReason: string;
      amountPaid: number;
      currency: string;
      priceId: string;
      allowedPrices: AllowedPrice[];
      periodStart: string;
      periodEnd: string;
      /** Set only for an authorized ABO → PRO checkout. Null leaves the second-subscription guard unchanged. */
      replacesSubscriptionId: string | null;
    }
  | {
      action: "sync_plan_change";
      userId: string;
      customerId: string;
      subscriptionId: string;
      scheduledPlanKey: string | null;
      scheduledEffectiveAt: string | null;
      eventCreated: number;
    }
  | {
      action: "invoice_failed";
      userId: string;
      customerId: string;
      subscriptionId: string | null;
      invoiceId: string;
      billingReason: string | null;
    };

export type InvoiceNormalize =
  | { status: "command"; command: BillingCommand }
  | { status: "incomplete"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isBillingUserId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isRecord(value) && typeof value.id === "string" && value.id.trim()) return value.id.trim();
  return null;
}

function asList(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];
  return value.data.filter(isRecord);
}

function unixToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function linePriceId(line: Record<string, unknown>): string | null {
  const pricing = isRecord(line.pricing) ? line.pricing : null;
  const details = pricing && isRecord(pricing.price_details) ? pricing.price_details : null;
  return idOf(details?.price) ?? idOf(line.price);
}

function isProration(line: Record<string, unknown>): boolean {
  const parent = isRecord(line.parent) ? line.parent : null;
  const sub = parent && isRecord(parent.subscription_item_details) ? parent.subscription_item_details : null;
  const item = parent && isRecord(parent.invoice_item_details) ? parent.invoice_item_details : null;
  return sub?.proration === true || item?.proration === true;
}

function linePeriod(line: Record<string, unknown>): { start: string; end: string } | null {
  const period = isRecord(line.period) ? line.period : null;
  const start = unixToIso(period?.start);
  const end = unixToIso(period?.end);
  if (!start || !end || start >= end) return null;
  return { start, end };
}

export function invoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  const parent = isRecord(invoice.parent) ? invoice.parent : null;
  const details = parent && isRecord(parent.subscription_details) ? parent.subscription_details : null;
  return idOf(details?.subscription) ?? idOf(invoice.subscription);
}

const STRIPE_SUBSCRIPTION_ID_RE = /^sub_[A-Za-z0-9]+$/;

/** The subscription named by Checkout metadata to end after this payment. Anything else is ignored. */
export function replacesSubscriptionId(invoice: Record<string, unknown>): string | null {
  const parent = isRecord(invoice.parent) ? invoice.parent : null;
  const details = parent && isRecord(parent.subscription_details) ? parent.subscription_details : null;
  const meta = details && isRecord(details.metadata) ? details.metadata : null;
  const own = isRecord(invoice.metadata) ? invoice.metadata : null;
  const candidate = meta?.replaces_subscription_id ?? own?.replaces_subscription_id;
  return typeof candidate === "string" && STRIPE_SUBSCRIPTION_ID_RE.test(candidate.trim())
    ? candidate.trim()
    : null;
}

export function invoiceCandidateUserId(invoice: Record<string, unknown>): string | null {
  const parent = isRecord(invoice.parent) ? invoice.parent : null;
  const details = parent && isRecord(parent.subscription_details) ? parent.subscription_details : null;
  const meta = details && isRecord(details.metadata) ? details.metadata : null;
  const own = isRecord(invoice.metadata) ? invoice.metadata : null;
  const candidate = meta?.user_id ?? own?.user_id;
  return isBillingUserId(candidate) ? candidate.trim() : null;
}

/**
 * A paid invoice either becomes a command the database will accept or reject,
 * or "incomplete" when a subscription invoice we might own has no service
 * period yet. Incomplete must not be persisted: a later retrieve can still
 * carry the line period.
 */
export function normalizePaidInvoice(
  invoice: unknown,
  catalog: readonly AllowedPrice[],
  userId: string,
): InvoiceNormalize {
  if (!isRecord(invoice) || !isBillingUserId(userId)) {
    return { status: "command", command: { action: "ignore", reason: "invoice_shape" } };
  }
  const invoiceId = idOf(invoice.id);
  const customerId = idOf(invoice.customer);
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!invoiceId || !customerId) {
    return { status: "command", command: { action: "ignore", reason: "invoice_shape" } };
  }
  if (!subscriptionId) {
    return {
      status: "command",
      command: {
        action: "invoice_paid",
        userId,
        customerId,
        subscriptionId: "",
        invoiceId,
        billingReason: typeof invoice.billing_reason === "string" ? invoice.billing_reason : "",
        amountPaid: typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0,
        currency: typeof invoice.currency === "string" ? invoice.currency : "",
        priceId: "",
        allowedPrices: [...catalog],
        periodStart: "",
        periodEnd: "",
        replacesSubscriptionId: null,
      },
    };
  }

  const allowedIds = new Set(catalog.map((entry) => entry.priceId));
  const reason = typeof invoice.billing_reason === "string" ? invoice.billing_reason : "";
  const lines = asList(invoice.lines).filter((line) => !isProration(line));
  const matched =
    lines.find((line) => {
      const priceId = linePriceId(line);
      return priceId !== null && allowedIds.has(priceId) && linePeriod(line);
    }) ?? null;
  if (
    (reason === "subscription_create" || reason === "subscription_cycle") &&
    !matched &&
    (lines.length === 0 ||
      lines.some((line) => {
        const priceId = linePriceId(line);
        return priceId === null || allowedIds.has(priceId);
      }))
  ) {
    return { status: "incomplete", reason: "invoice_lines" };
  }

  const chosen = matched ?? lines.find((line) => linePeriod(line)) ?? null;
  const period = chosen ? linePeriod(chosen) : null;
  return {
    status: "command",
    command: {
      action: "invoice_paid",
      userId,
      customerId,
      subscriptionId,
      invoiceId,
      billingReason: reason,
      amountPaid: typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0,
      currency: typeof invoice.currency === "string" ? invoice.currency : "",
      priceId: chosen ? (linePriceId(chosen) ?? "") : "",
      allowedPrices: [...catalog],
      periodStart: period?.start ?? "",
      periodEnd: period?.end ?? "",
      replacesSubscriptionId: replacesSubscriptionId(invoice),
    },
  };
}

export function normalizeFailedInvoice(invoice: unknown, userId: string): BillingCommand {
  if (!isRecord(invoice) || !isBillingUserId(userId)) {
    return { action: "ignore", reason: "invoice_shape" };
  }
  const invoiceId = idOf(invoice.id);
  const customerId = idOf(invoice.customer);
  if (!invoiceId || !customerId) return { action: "ignore", reason: "invoice_shape" };
  return {
    action: "invoice_failed",
    userId,
    customerId,
    subscriptionId: invoiceSubscriptionId(invoice),
    invoiceId,
    billingReason: typeof invoice.billing_reason === "string" ? invoice.billing_reason : null,
  };
}

export function normalizeSubscription(
  subscription: unknown,
  eventCreated: number,
  userId: string,
  catalog: readonly AllowedPrice[],
): BillingCommand {
  if (!isRecord(subscription) || !isBillingUserId(userId)) {
    return { action: "ignore", reason: "subscription_shape" };
  }
  const subscriptionId = idOf(subscription.id);
  const customerId = idOf(subscription.customer);
  const status = subscription.status;
  if (!subscriptionId || !customerId || typeof status !== "string") {
    return { action: "ignore", reason: "subscription_shape" };
  }
  if (!(STRIPE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) {
    return { action: "ignore", reason: "unknown_status" };
  }
  const allowedIds = new Set(catalog.map((entry) => entry.priceId));
  const items = asList(subscription.items);
  const item =
    items.find((entry) => {
      const priceId = itemPriceId(entry);
      return priceId !== null && allowedIds.has(priceId);
    }) ?? items[0] ?? null;
  const latest = idOf(subscription.latest_invoice);
  return {
    action: "sync_subscription",
    userId,
    customerId,
    subscriptionId,
    status: status as StripeSubscriptionStatus,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    cancelAt: unixToIso(subscription.cancel_at),
    currentPeriodStart: item ? unixToIso(item.current_period_start) : null,
    currentPeriodEnd: item ? unixToIso(item.current_period_end) : null,
    priceId: item ? itemPriceId(item) : null,
    latestInvoiceId: latest,
    eventCreated: Number.isFinite(eventCreated) ? eventCreated : 0,
  };
}

function itemPriceId(item: Record<string, unknown>): string | null {
  return idOf(item.price) ?? idOf(isRecord(item.price) ? item.price.id : null);
}

export function subscriptionCandidateUserId(subscription: unknown): string | null {
  if (!isRecord(subscription) || !isRecord(subscription.metadata)) return null;
  const candidate = subscription.metadata.user_id;
  return isBillingUserId(candidate) ? candidate.trim() : null;
}

export function normalizeCheckoutSession(session: unknown): BillingCommand | "incomplete" {
  if (!isRecord(session)) return { action: "ignore", reason: "session_shape" };
  if (session.mode !== "subscription") return { action: "ignore", reason: "not_subscription" };
  const userId = session.client_reference_id;
  const metadata = isRecord(session.metadata) ? session.metadata : null;
  const metaUser = metadata?.user_id;
  if (!isBillingUserId(userId)) return { action: "ignore", reason: "session_user" };
  if (metaUser !== undefined && metaUser !== null && metaUser !== userId.trim()) {
    return { action: "ignore", reason: "session_user_mismatch" };
  }
  const customerId = idOf(session.customer);
  if (!customerId) return "incomplete";
  return { action: "link_customer", userId: userId.trim(), customerId };
}

/** JSON object stored by apply_stripe_billing_event. Field names match the SQL. */
export function commandPayload(command: BillingCommand): Record<string, unknown> {
  switch (command.action) {
    case "ignore":
      return { action: "ignore", reason: command.reason };
    case "link_customer":
      return { action: "link_customer", user_id: command.userId, customer_id: command.customerId };
    case "invoice_failed":
      return {
        action: "invoice_failed",
        user_id: command.userId,
        customer_id: command.customerId,
        subscription_id: command.subscriptionId,
        invoice_id: command.invoiceId,
        billing_reason: command.billingReason,
      };
    case "sync_subscription":
      return {
        action: "sync_subscription",
        user_id: command.userId,
        customer_id: command.customerId,
        subscription_id: command.subscriptionId,
        status: command.status,
        cancel_at_period_end: command.cancelAtPeriodEnd,
        cancel_at: command.cancelAt,
        current_period_start: command.currentPeriodStart,
        current_period_end: command.currentPeriodEnd,
        price_id: command.priceId,
        latest_invoice_id: command.latestInvoiceId,
        event_created: command.eventCreated,
      };
    case "invoice_paid":
      return {
        action: "invoice_paid",
        user_id: command.userId,
        customer_id: command.customerId,
        subscription_id: command.subscriptionId,
        invoice_id: command.invoiceId,
        billing_reason: command.billingReason,
        amount_paid: command.amountPaid,
        currency: command.currency,
        price_id: command.priceId,
        allowed_prices: command.allowedPrices.map((entry) => ({
          price_id: entry.priceId,
          amount: entry.amount,
          currency: entry.currency,
          plan_key: entry.planKey,
          address_limit: entry.addressLimit,
        })),
        period_start: command.periodStart,
        period_end: command.periodEnd,
        replaces_subscription_id: command.replacesSubscriptionId,
      };
    case "sync_plan_change":
      return {
        action: "sync_plan_change",
        user_id: command.userId,
        customer_id: command.customerId,
        subscription_id: command.subscriptionId,
        scheduled_plan_key: command.scheduledPlanKey,
        scheduled_effective_at: command.scheduledEffectiveAt,
        event_created: command.eventCreated,
      };
  }
}

export function isStripeRedirectUrl(raw: string, kind: "checkout" | "portal"): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    return kind === "checkout"
      ? url.hostname === "checkout.stripe.com"
      : url.hostname === "billing.stripe.com";
  } catch {
    return false;
  }
}
