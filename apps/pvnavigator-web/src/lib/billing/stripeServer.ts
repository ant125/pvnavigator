import "server-only";

import {
  PAID_PLAN_IDS,
  PAID_PLANS,
  SUBSCRIPTION_PRICE_CURRENCY,
  VAT_EXEMPTION_LABEL,
  type PaidPlanId,
} from "@pv-access/core";
import Stripe from "stripe";

import type { AllowedPrice } from "./stripeEvents";

let stripeClient: Stripe | null = null;
let stripeClientKey = "";
const verifiedPriceIds = new Set<string>();

export type StripeRuntimeMode = "test" | "live";

/**
 * The secret or restricted key selects one Stripe account. A publishable key
 * or any other value leaves billing closed.
 */
export function stripeRuntimeMode(key = process.env.STRIPE_SECRET_KEY?.trim() ?? ""): StripeRuntimeMode | null {
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return null;
}

export function expectedLivemode(): boolean | null {
  const mode = stripeRuntimeMode();
  if (mode === "live") return true;
  if (mode === "test") return false;
  return null;
}

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Stripe billing is not configured");
    this.name = "BillingNotConfiguredError";
  }
}

export class BillingPriceError extends Error {
  constructor() {
    super("Configured Stripe price does not match an allowed PVNAVIGATOR_ monthly tariff");
    this.name = "BillingPriceError";
  }
}

/** One client for the configured account. A missing or malformed key leaves billing closed. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!stripeRuntimeMode(key)) return null;
  if (!stripeClient || stripeClientKey !== key) {
    stripeClient = new Stripe(key);
    stripeClientKey = key;
    verifiedPriceIds.clear();
  }
  return stripeClient;
}

export function getWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  return secret.startsWith("whsec_") ? secret : null;
}

/**
 * Allowed Price IDs from the server environment, paired with the fixed
 * tariff, currency, amount and address limit. Does not create products.
 * A Price ID that is not set is omitted. The same ID cannot back two tariffs.
 */
export function loadPriceCatalog(): AllowedPrice[] {
  const rows: AllowedPrice[] = [];
  const seen = new Set<string>();
  for (const id of PAID_PLAN_IDS) {
    const plan = PAID_PLANS[id];
    const priceId = process.env[plan.priceEnvVar]?.trim() ?? "";
    if (!priceId.startsWith("price_")) continue;
    if (seen.has(priceId)) throw new BillingPriceError();
    seen.add(priceId);
    rows.push({
      priceId,
      amount: plan.priceCents,
      currency: SUBSCRIPTION_PRICE_CURRENCY,
      planKey: plan.planKey,
      addressLimit: plan.addressLimit,
    });
  }
  return rows;
}

export function catalogEntryForPlan(plan: PaidPlanId): AllowedPrice | null {
  const spec = PAID_PLANS[plan];
  return loadPriceCatalog().find((entry) => entry.planKey === spec.planKey) ?? null;
}

/**
 * Confirms the configured Price is the monthly EUR price for this tariff
 * in the same Stripe mode as the secret key. Does not create a product or price.
 */
export async function assertPlanPrice(stripe: Stripe, plan: PaidPlanId): Promise<AllowedPrice> {
  const entry = catalogEntryForPlan(plan);
  const livemode = expectedLivemode();
  if (!entry || livemode === null) throw new BillingNotConfiguredError();
  if (verifiedPriceIds.has(entry.priceId)) return entry;
  const price = await stripe.prices.retrieve(entry.priceId, { expand: ["product"] });
  const product = price.product;
  const productName =
    product && typeof product === "object" && "name" in product && typeof product.name === "string"
      ? product.name
      : "";
  const recurring = price.recurring;
  if (
    price.livemode !== livemode ||
    !price.active ||
    price.currency !== entry.currency ||
    price.unit_amount !== entry.amount ||
    recurring?.interval !== "month" ||
    (recurring?.interval_count ?? 1) !== 1 ||
    !productName.includes("PVNAVIGATOR")
  ) {
    throw new BillingPriceError();
  }
  verifiedPriceIds.add(entry.priceId);
  return entry;
}

export const INVOICE_TAX_FOOTER = VAT_EXEMPTION_LABEL;

export function checkoutSubmitMessage(priceLabel: string): string {
  return `${VAT_EXEMPTION_LABEL} ${priceLabel} pro Monat ist der Endpreis.`;
}
