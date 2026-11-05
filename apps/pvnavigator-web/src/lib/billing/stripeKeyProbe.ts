import Stripe from "stripe";

import { loadPriceCatalog } from "./stripeServer";

const KEY_KINDS = ["rk_live_", "sk_live_", "pk_live_", "rk_test_", "sk_test_", "pk_test_"] as const;
const WEBHOOK_URL = "https://pvnavigator.de/api/billing/webhook";

export type StripeKeyKind = (typeof KEY_KINDS)[number] | "missing" | "invalid";

export type StripeKeyDescription = {
  kind: StripeKeyKind;
  quoted: boolean;
};

export type StripeReadReport = {
  account: { ok: boolean; livemode: boolean | null; error: string | null };
  prices: Array<{
    planKey: string;
    ok: boolean;
    livemode: boolean | null;
    active: boolean | null;
    currency: string | null;
    amount: number | null;
    interval: string | null;
    intervalCount: number | null;
    productNameOk: boolean | null;
    matchesCatalog: boolean;
    error: string | null;
  }>;
  reads: Record<string, string>;
  webhook: {
    found: boolean;
    livemode: boolean | null;
    status: string | null;
    apiVersion: string | null;
    eventCount: number | null;
  } | null;
};

export type StripeKeyProbe = {
  direct: StripeKeyDescription;
  runtime: StripeKeyDescription;
  reads: StripeReadReport | null;
};

/** Classifies a key prefix. The result never includes the key itself. */
export function describeStripeKey(value: string): StripeKeyDescription {
  const trimmed = value.trim();
  if (!trimmed) return { kind: "missing", quoted: false };
  const direct = kindOf(trimmed);
  if (direct) return { kind: direct, quoted: false };
  const unquoted = trimmed.replace(/^['"]+|['"]+$/g, "");
  const wrapped = unquoted === trimmed ? null : kindOf(unquoted);
  if (wrapped) return { kind: wrapped, quoted: true };
  return { kind: "invalid", quoted: false };
}

/**
 * Reads the production key and the configured prices. Listing calls do not
 * create customers, sessions, subscriptions, or invoices.
 */
export async function probeProductionStripe(): Promise<StripeKeyProbe> {
  const direct = describeStripeKey(process.env.STRIPE_SECRET_KEY ?? "");
  const runtimeValue = process.env[["STRIPE", "SECRET", "KEY"].join("_")] ?? "";
  const runtime = describeStripeKey(runtimeValue);
  const usable = runtime.kind === "sk_live_" || runtime.kind === "rk_live_" || runtime.kind === "sk_test_" || runtime.kind === "rk_test_";
  if (!usable || runtime.quoted) return { direct, runtime, reads: null };
  return {
    direct,
    runtime,
    reads: await inspectStripeAccess(new Stripe(runtimeValue.trim()), runtime.kind.endsWith("live_")),
  };
}

export async function inspectStripeAccess(stripe: Stripe, livemode: boolean): Promise<StripeReadReport> {
  let account: StripeReadReport["account"];
  try {
    const balance = await stripe.balance.retrieve();
    account = {
      ok: true,
      livemode: typeof balance.livemode === "boolean" ? balance.livemode : null,
      error: null,
    };
  } catch (error) {
    account = { ok: false, livemode: null, error: safeStripeError(error) };
  }

  const prices: StripeReadReport["prices"] = [];
  for (const entry of loadPriceCatalog()) {
    try {
      const price = await stripe.prices.retrieve(entry.priceId, { expand: ["product"] });
      const product = price.product;
      const productName =
        product && typeof product === "object" && "name" in product && typeof product.name === "string"
          ? product.name
          : "";
      const recurring = price.recurring;
      const productNameOk = productName.includes("PVNAVIGATOR");
      const matchesCatalog =
        price.livemode === livemode &&
        price.active &&
        price.currency === entry.currency &&
        price.unit_amount === entry.amount &&
        recurring?.interval === "month" &&
        (recurring.interval_count ?? 1) === 1 &&
        productNameOk;
      prices.push({
        planKey: entry.planKey,
        ok: true,
        livemode: price.livemode,
        active: price.active,
        currency: price.currency,
        amount: price.unit_amount,
        interval: recurring?.interval ?? null,
        intervalCount: recurring?.interval_count ?? null,
        productNameOk,
        matchesCatalog,
        error: null,
      });
    } catch (error) {
      prices.push({
        planKey: entry.planKey,
        ok: false,
        livemode: null,
        active: null,
        currency: null,
        amount: null,
        interval: null,
        intervalCount: null,
        productNameOk: null,
        matchesCatalog: false,
        error: safeStripeError(error),
      });
    }
  }

  const reads: Record<string, string> = {
    customers: await readStatus(() => stripe.customers.list({ limit: 1 })),
    checkoutSessions: await readStatus(() => stripe.checkout.sessions.list({ limit: 1 })),
    subscriptions: await readStatus(() => stripe.subscriptions.list({ limit: 1 })),
    invoices: await readStatus(() => stripe.invoices.list({ limit: 1 })),
    billingPortal: await readStatus(() => stripe.billingPortal.configurations.list({ limit: 1 })),
  };

  let webhook: StripeReadReport["webhook"] = null;
  try {
    const listed = await stripe.webhookEndpoints.list({ limit: 100 });
    const endpoint = listed.data.find((item) => item.url === WEBHOOK_URL) ?? null;
    webhook = {
      found: endpoint !== null,
      livemode: endpoint?.livemode ?? null,
      status: endpoint?.status ?? null,
      apiVersion: endpoint?.api_version ?? null,
      eventCount: endpoint?.enabled_events.length ?? null,
    };
    reads.webhookEndpoints = "ok";
  } catch (error) {
    reads.webhookEndpoints = safeStripeError(error);
  }

  return { account, prices, reads, webhook };
}

function kindOf(value: string): (typeof KEY_KINDS)[number] | null {
  return KEY_KINDS.find((kind) => value.startsWith(kind)) ?? null;
}

async function readStatus(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
    return "ok";
  } catch (error) {
    return safeStripeError(error);
  }
}

function safeStripeError(error: unknown): string {
  if (!error || typeof error !== "object") return "error";
  const record = error as { type?: unknown; code?: unknown; statusCode?: unknown };
  const status = typeof record.statusCode === "number" ? String(record.statusCode) : "";
  const type = typeof record.type === "string" ? record.type : "error";
  const code = typeof record.code === "string" ? record.code : "";
  return [status, type, code].filter(Boolean).join(":");
}
