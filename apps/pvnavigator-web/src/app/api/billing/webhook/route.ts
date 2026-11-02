import type Stripe from "stripe";

import { applyBillingEvent, resolveBillingUser } from "@/lib/billing/applyBillingEvent";
import { finishFailedRenewals } from "@/lib/billing/finishFailedRenewals";
import { finishUpgradeReplacements } from "@/lib/billing/finishUpgradeReplacements";
import {
  invoiceCandidateUserId,
  normalizeCheckoutSession,
  normalizeFailedInvoice,
  normalizePaidInvoice,
  normalizeSubscription,
  subscriptionCandidateUserId,
  type BillingCommand,
} from "@/lib/billing/stripeEvents";
import { readScheduledPlan } from "@/lib/billing/stripePlanChange";
import {
  loadPriceCatalog,
  getStripe,
  getWebhookSecret,
  expectedLivemode,
  BillingPriceError,
} from "@/lib/billing/stripeServer";
import type { AllowedPrice } from "@/lib/billing/stripeEvents";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }
  return null;
}

/**
 * Stripe signature is checked against the raw body. The success page never
 * grants access; only a paid invoice command that the database accepts does.
 */
export async function POST(request: Request): Promise<Response> {
  const stripe = getStripe();
  const secret = getWebhookSecret();
  const admin = createServiceRoleClient();
  let catalog: AllowedPrice[];
  try {
    catalog = loadPriceCatalog();
  } catch (error) {
    if (error instanceof BillingPriceError) {
      return new Response("Billing is not configured", { status: 500 });
    }
    throw error;
  }
  if (!stripe || !secret || !admin || catalog.length === 0) {
    return new Response("Billing is not configured", { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const livemode = expectedLivemode();
  if (livemode === null || event.livemode !== livemode) {
    return Response.json({ received: true });
  }

  try {
    const command = await commandForEvent(stripe, event, catalog, admin);
    if (command === "retry") {
      return new Response("Retry", { status: 500 });
    }
    const applied = await applyBillingEvent(admin, {
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      command,
    });
    if (!applied.ok) return new Response("Retry", { status: 500 });
    // A duplicate event still retries ending the ABO subscription and closing
    // a failed monthly renewal. A period is granted only inside
    // applyBillingEvent, from invoice.paid.
    const replacements = await finishUpgradeReplacements(stripe, admin);
    if (!replacements.ok) return new Response("Retry", { status: 500 });
    const renewals = await finishFailedRenewals(stripe, admin);
    if (!renewals.ok) return new Response("Retry", { status: 500 });
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed", event.id, event.type, error instanceof Error ? error.name : "error");
    return new Response("Retry", { status: 500 });
  }
}

async function commandForEvent(
  stripe: Stripe,
  event: Stripe.Event,
  catalog: readonly AllowedPrice[],
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
): Promise<BillingCommand | "retry"> {
  switch (event.type) {
    case "checkout.session.completed": {
      let command = normalizeCheckoutSession(event.data.object);
      if (command === "incomplete") {
        const sessionId = idOf(event.data.object);
        if (!sessionId) return { action: "ignore", reason: "session_shape" };
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        command = normalizeCheckoutSession(session);
      }
      if (command === "incomplete") return "retry";
      return command;
    }
    case "invoice.paid":
      return paidInvoiceCommand(stripe, event.data.object, catalog, admin);
    case "invoice.payment_failed":
      // invoice.payment_action_required stays on the default path. A renewal
      // that still needs authentication is not closed here.
      return failedInvoiceCommand(event.data.object, admin);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return subscriptionCommand(stripe, event, catalog, admin);
    case "subscription_schedule.created":
    case "subscription_schedule.updated":
    case "subscription_schedule.released":
    case "subscription_schedule.canceled":
    case "subscription_schedule.completed":
      return scheduleCommand(event, catalog, admin);
    default:
      return { action: "ignore", reason: "unhandled" };
  }
}

async function paidInvoiceCommand(
  stripe: Stripe,
  object: unknown,
  catalog: readonly AllowedPrice[],
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
): Promise<BillingCommand | "retry"> {
  let invoice = object;
  let normalized = await withUser(invoice, admin, (userId) =>
    normalizePaidInvoice(invoice, catalog, userId),
  );
  if (normalized === "retry") return "retry";
  if (normalized === "mismatch") return { action: "ignore", reason: "customer_mismatch" };
  if (normalized.status === "incomplete") {
    const invoiceId = idOf(invoice);
    if (!invoiceId) return { action: "ignore", reason: "invoice_shape" };
    invoice = await stripe.invoices.retrieve(invoiceId);
    normalized = await withUser(invoice, admin, (userId) =>
      normalizePaidInvoice(invoice, catalog, userId),
    );
    if (normalized === "retry") return "retry";
    if (normalized === "mismatch") return { action: "ignore", reason: "customer_mismatch" };
    if (normalized.status === "incomplete") return "retry";
  }
  return normalized.command;
}

async function withUser(
  invoice: unknown,
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  build: (userId: string) => ReturnType<typeof normalizePaidInvoice>,
): Promise<ReturnType<typeof normalizePaidInvoice> | "retry" | "mismatch"> {
  const record = invoice && typeof invoice === "object" ? (invoice as Record<string, unknown>) : null;
  const customerId = record ? idOf(record.customer) : null;
  const resolved = await resolveBillingUser(admin, customerId, record ? invoiceCandidateUserId(record) : null);
  if ("mismatch" in resolved) return "mismatch";
  if ("missing" in resolved) return "retry";
  return build(resolved.userId);
}

async function failedInvoiceCommand(
  object: unknown,
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
): Promise<BillingCommand | "retry"> {
  const record = object && typeof object === "object" ? (object as Record<string, unknown>) : null;
  if (!record) return { action: "ignore", reason: "invoice_shape" };
  const resolved = await resolveBillingUser(
    admin,
    idOf(record.customer),
    invoiceCandidateUserId(record),
  );
  if ("mismatch" in resolved) return { action: "ignore", reason: "customer_mismatch" };
  if ("missing" in resolved) return "retry";
  return normalizeFailedInvoice(record, resolved.userId);
}

async function subscriptionCommand(
  stripe: Stripe,
  event: Stripe.Event,
  catalog: readonly AllowedPrice[],
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
): Promise<BillingCommand | "retry"> {
  let subscription = event.data.object as unknown as Record<string, unknown>;
  if (!Array.isArray((subscription.items as { data?: unknown } | undefined)?.data)) {
    const subscriptionId = idOf(subscription);
    if (!subscriptionId) return { action: "ignore", reason: "subscription_shape" };
    subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as Record<string, unknown>;
  }
  const resolved = await resolveBillingUser(
    admin,
    idOf(subscription.customer),
    subscriptionCandidateUserId(subscription),
  );
  if ("mismatch" in resolved) return { action: "ignore", reason: "customer_mismatch" };
  if ("missing" in resolved) return "retry";
  return normalizeSubscription(subscription, event.created, resolved.userId, catalog);
}

async function scheduleCommand(
  event: Stripe.Event,
  catalog: readonly AllowedPrice[],
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
): Promise<BillingCommand | "retry"> {
  const schedule = event.data.object as unknown as Record<string, unknown>;
  const subscriptionId = idOf(schedule.subscription);
  const customerId = idOf(schedule.customer);
  if (!subscriptionId || !customerId) return { action: "ignore", reason: "schedule_shape" };
  const resolved = await resolveBillingUser(admin, customerId, null);
  if ("mismatch" in resolved) return { action: "ignore", reason: "customer_mismatch" };
  if ("missing" in resolved) return "retry";
  const view = readScheduledPlan(schedule, catalog);
  if (view.kind === "unchanged") return { action: "ignore", reason: "schedule_unchanged" };
  return {
    action: "sync_plan_change",
    userId: resolved.userId,
    customerId,
    subscriptionId,
    scheduledPlanKey: view.kind === "scheduled" ? view.planKey : null,
    scheduledEffectiveAt: view.kind === "scheduled" ? view.effectiveAt : null,
    eventCreated: event.created,
  };
}
