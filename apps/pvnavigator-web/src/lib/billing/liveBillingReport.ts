import type Stripe from "stripe";

import { loadPriceCatalog } from "./stripeServer";

const PRODUCTION_REF = "ftxgcpebzrhvifjnjivm";
const WEBHOOK_URL = "https://pvnavigator.de/api/billing/webhook";

export type LiveBillingReport = {
  mode: "live";
  webhookSecretShape: boolean;
  serviceRole: { production: boolean; role: string | null };
  prices: Array<{
    planKey: string;
    livemode: boolean;
    active: boolean;
    currency: string;
    amount: number | null;
    interval: string | null;
    intervalCount: number | null;
    productNameOk: boolean;
  }>;
  webhook: {
    found: boolean;
    livemode: boolean | null;
    status: string | null;
    apiVersion: string | null;
    eventCount: number | null;
  } | null;
};

let reported = false;

/** Reads the live catalog once. The log contains no key, secret, or price id. */
export async function reportLiveBillingConfig(stripe: Stripe): Promise<LiveBillingReport | null> {
  if (reported) return null;
  reported = true;
  const report = await buildLiveBillingReport(stripe);
  console.log(JSON.stringify({ event: "live_billing_config", ...report }));
  return report;
}

export async function buildLiveBillingReport(stripe: Stripe): Promise<LiveBillingReport> {
  const prices = [];
  for (const entry of loadPriceCatalog()) {
    const price = await stripe.prices.retrieve(entry.priceId, { expand: ["product"] });
    const product = price.product;
    const productName =
      product && typeof product === "object" && "name" in product && typeof product.name === "string"
        ? product.name
        : "";
    prices.push({
      planKey: entry.planKey,
      livemode: price.livemode,
      active: price.active,
      currency: price.currency,
      amount: price.unit_amount,
      interval: price.recurring?.interval ?? null,
      intervalCount: price.recurring?.interval_count ?? null,
      productNameOk: productName.includes("PVNAVIGATOR"),
    });
  }

  const listed = await stripe.webhookEndpoints.list({ limit: 100 });
  const endpoint = listed.data.find((item) => item.url === WEBHOOK_URL) ?? null;
  return {
    mode: "live",
    webhookSecretShape: (process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "").startsWith("whsec_"),
    serviceRole: serviceRoleClaims(),
    prices,
    webhook: {
      found: endpoint !== null,
      livemode: endpoint?.livemode ?? null,
      status: endpoint?.status ?? null,
      apiVersion: endpoint?.api_version ?? null,
      eventCount: endpoint?.enabled_events.length ?? null,
    },
  };
}

function serviceRoleClaims(): { production: boolean; role: string | null } {
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const payload = token.split(".")[1];
  if (!payload) return { production: false, role: null };
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      role?: unknown;
      ref?: unknown;
    };
    const role = typeof claims.role === "string" ? claims.role : null;
    return {
      production: role === "service_role" && claims.ref === PRODUCTION_REF && url.includes(PRODUCTION_REF),
      role,
    };
  } catch {
    return { production: false, role: null };
  }
}
