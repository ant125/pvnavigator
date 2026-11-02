import { PAID_PLANS, type PaidPlanId } from "@pv-access/core";
import type Stripe from "stripe";

import { checkoutInvoiceCollection } from "./checkoutInvoice";

/** Immediate upgrades. STARTER is only a source plan, never a target. */
export type UpgradeTargetId = Exclude<PaidPlanId, "starter">;

/**
 * Missing plan keeps the existing ABO → PRO button, which posts no field.
 * STARTER and any other value are rejected before a Checkout starts.
 */
export function upgradeTargetFromForm(value: unknown): UpgradeTargetId | null {
  if (value == null || value === "") return "pro";
  if (value === "abo" || value === "pro") return value;
  return null;
}

export type StoredUpgradeSession = "reuse" | "block-open" | "replace-settled";

/**
 * A paid or completed Checkout is not an in-progress upgrade.
 * An open unpaid session for another plan still blocks a second checkout.
 */
export function storedUpgradeSessionDisposition(session: {
  paymentStatus: string | null;
  status: string | null;
  planKey: string | null;
  targetPlanKey: string;
}): StoredUpgradeSession {
  if (session.paymentStatus === "paid" || session.status === "complete") return "replace-settled";
  if (session.planKey && session.planKey !== session.targetPlanKey) return "block-open";
  return "reuse";
}

/**
 * Checkout session fields for an immediate higher-plan purchase.
 * The price id is the server catalog entry. The browser never supplies an amount.
 * The old subscription is named so the webhook can end it after invoice.paid.
 */
export function upgradeCheckoutSession(args: {
  userId: string;
  customerId: string;
  priceId: string;
  plan: UpgradeTargetId;
  replacesSubscriptionId: string | null;
  periodId: string;
  origin: string;
  submitMessage: string;
}): Stripe.Checkout.SessionCreateParams & { idempotencyKey: string } {
  const spec = PAID_PLANS[args.plan];
  const replaces = args.replacesSubscriptionId ?? "";
  const metadata = {
    user_id: args.userId,
    plan_key: spec.planKey,
    replaces_subscription_id: replaces,
  };
  return {
    mode: "subscription",
    customer: args.customerId,
    client_reference_id: args.userId,
    success_url: `${args.origin}/tarife/erfolg?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.origin}/tarife/abgebrochen`,
    line_items: [{ price: args.priceId, quantity: 1 }],
    metadata,
    subscription_data: {
      description: `PVNAVIGATOR_ ${spec.label}`,
      metadata,
    },
    custom_text: { submit: { message: args.submitMessage } },
    ...checkoutInvoiceCollection(),
    idempotencyKey: `pvn-upgrade-${args.userId}-${args.periodId}-${args.plan}`,
  };
}
