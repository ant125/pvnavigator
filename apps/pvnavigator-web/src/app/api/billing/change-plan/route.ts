import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { PAID_PLANS, paidPlanById, type PaidPlanId } from "@pv-access/core";

import { applyBillingEvent } from "@/lib/billing/applyBillingEvent";
import { billingFormAllowed, redirectLoginForTariff, redirectTarife } from "@/lib/billing/billingHttp";
import { planChangeUpdate, readScheduledPlan } from "@/lib/billing/stripePlanChange";
import {
  BillingNotConfiguredError,
  BillingPriceError,
  assertPlanPrice,
  catalogEntryForPlan,
  expectedLivemode,
  getStripe,
  loadPriceCatalog,
} from "@/lib/billing/stripeServer";
import type { AllowedPrice } from "@/lib/billing/stripeEvents";
import { getServerUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_STATUSES = new Set(["active", "past_due"]);

/**
 * Moves an existing subscription to the other paid tariff at the next period.
 * Does not open Checkout and does not prorate the current period.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!billingFormAllowed(request)) return redirectTarife();

  let plan: PaidPlanId | null = null;
  try {
    plan = paidPlanById((await request.formData()).get("plan"));
  } catch {
    return redirectTarife("wechsel-fehler");
  }
  // STARTER is a new checkout. Period-end switches stay between ABO and PRO.
  if (!plan || plan === "starter") return redirectTarife("wechsel-fehler");

  const user = await getServerUser();
  if (!user) return redirectLoginForTariff(plan);

  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!stripe || !admin) return redirectTarife("nicht-konfiguriert");
  if (!catalogEntryForPlan(plan)) {
    return redirectTarife(plan === "pro" ? "pro-preis" : "nicht-konfiguriert");
  }

  const [customerResult, subscriptionResult] = await Promise.all([
    admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle(),
    admin
      .from("stripe_subscriptions")
      .select("stripe_subscription_id, status, cancel_at_period_end, stripe_customer_id")
      .eq("user_id", user.id),
  ]);
  if (customerResult.error || subscriptionResult.error) return redirectTarife("wechsel-fehler");

  const customerId = customerResult.data?.stripe_customer_id;
  if (typeof customerId !== "string" || !customerId) return redirectTarife("kein-abo");

  const open = (subscriptionResult.data ?? []).filter(
    (row) => typeof row.status === "string" && OPEN_STATUSES.has(row.status),
  );
  if (open.length === 0) return redirectTarife("kein-abo");
  if (open.length > 1) return redirectTarife("bereits-aktiv");
  const current = open[0];
  if (current.stripe_customer_id !== customerId) return redirectTarife("wechsel-fehler");
  if (current.cancel_at_period_end) return redirectTarife("gekuendigt");

  try {
    const catalog = loadPriceCatalog();
    const target = await assertPlanPrice(stripe, plan);
    const subscription = await stripe.subscriptions.retrieve(current.stripe_subscription_id);
    if (subscription.livemode !== expectedLivemode()) return redirectTarife("wechsel-fehler");
    const stripeCustomer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (stripeCustomer !== customerId) return redirectTarife("wechsel-fehler");
    if (subscription.cancel_at_period_end) return redirectTarife("gekuendigt");

    const item = preferredItem(subscription, catalog);
    const currentPriceId = item ? priceIdOf(item.price) : null;
    const periodEnd = item?.current_period_end;
    if (!item || !currentPriceId || typeof periodEnd !== "number") return redirectTarife("wechsel-fehler");

    const scheduleRef = subscription.schedule;
    const scheduleId = !scheduleRef ? null : typeof scheduleRef === "string" ? scheduleRef : scheduleRef.id;

    if (currentPriceId === target.priceId) {
      if (scheduleId) {
        const released = await stripe.subscriptionSchedules.release(scheduleId);
        await recordPlanChange(
          admin,
          user.id,
          customerId,
          current.stripe_subscription_id,
          released,
          catalog,
          subscription.livemode,
        );
      }
      return redirectTarife("wechsel");
    }

    const schedule = scheduleId
      ? await stripe.subscriptionSchedules.retrieve(scheduleId)
      : await stripe.subscriptionSchedules.create({ from_subscription: current.stripe_subscription_id });
    const phase = schedule.current_phase;
    if (!phase || phase.start_date >= periodEnd) return redirectTarife("wechsel-fehler");

    const updated = await stripe.subscriptionSchedules.update(
      schedule.id,
      planChangeUpdate({
        currentStart: phase.start_date,
        currentEnd: periodEnd,
        currentPriceId,
        nextPriceId: target.priceId,
      }),
    );
    const view = readScheduledPlan(updated, catalog);
    if (view.kind !== "scheduled" || view.planKey !== PAID_PLANS[plan].planKey) {
      return redirectTarife("wechsel-fehler");
    }
    await recordPlanChange(
      admin,
      user.id,
      customerId,
      current.stripe_subscription_id,
      updated,
      catalog,
      subscription.livemode,
    );
    return redirectTarife("wechsel");
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return redirectTarife(plan === "pro" ? "pro-preis" : "nicht-konfiguriert");
    }
    if (error instanceof BillingPriceError) return redirectTarife("preis");
    console.error("Stripe plan change failed", error instanceof Error ? error.name : "error");
    return redirectTarife("wechsel-fehler");
  }
}

function priceIdOf(price: Stripe.Price | Stripe.DeletedPrice | string | null | undefined): string | null {
  if (!price) return null;
  if (typeof price === "string") return price;
  return price.id ?? null;
}

function preferredItem(subscription: Stripe.Subscription, catalog: readonly AllowedPrice[]) {
  const ids = new Set(catalog.map((entry) => entry.priceId));
  return (
    subscription.items.data.find((item) => {
      const id = priceIdOf(item.price);
      return id !== null && ids.has(id);
    }) ?? subscription.items.data[0] ?? null
  );
}

async function recordPlanChange(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  customerId: string,
  subscriptionId: string,
  schedule: Stripe.SubscriptionSchedule,
  catalog: readonly AllowedPrice[],
  livemode: boolean,
): Promise<void> {
  const view = readScheduledPlan(schedule, catalog);
  if (view.kind === "unchanged") return;
  const applied = await applyBillingEvent(admin, {
    eventId: `app_plan_${subscriptionId}_${schedule.id}_${Math.floor(Date.now() / 1000)}`,
    eventType: "app.plan_change",
    livemode,
    command: {
      action: "sync_plan_change",
      userId,
      customerId,
      subscriptionId,
      scheduledPlanKey: view.kind === "scheduled" ? view.planKey : null,
      scheduledEffectiveAt: view.kind === "scheduled" ? view.effectiveAt : null,
      eventCreated: Math.floor(Date.now() / 1000),
    },
  });
  if (!applied.ok) console.error("plan change was not stored");
}
