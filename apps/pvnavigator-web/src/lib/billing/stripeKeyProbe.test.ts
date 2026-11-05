import { afterEach, describe, expect, it } from "vitest";

import { describeStripeKey, inspectStripeAccess, probeProductionStripe } from "./stripeKeyProbe";

const secret = "sk_live_unit_probe";
const previous = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PRICE_STARTER_ID: process.env.STRIPE_PRICE_STARTER_ID,
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
  STRIPE_PRICE_PRO_ID: process.env.STRIPE_PRICE_PRO_ID,
};

afterEach(() => {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("stripe key class", () => {
  it("recognizes secret, restricted, and publishable prefixes", () => {
    expect(describeStripeKey("rk_live_example")).toEqual({ kind: "rk_live_", quoted: false });
    expect(describeStripeKey("sk_live_example")).toEqual({ kind: "sk_live_", quoted: false });
    expect(describeStripeKey("pk_live_example")).toEqual({ kind: "pk_live_", quoted: false });
    expect(describeStripeKey("rk_test_example")).toEqual({ kind: "rk_test_", quoted: false });
    expect(describeStripeKey("sk_test_example")).toEqual({ kind: "sk_test_", quoted: false });
    expect(describeStripeKey("  pk_test_example")).toEqual({ kind: "pk_test_", quoted: false });
    expect(describeStripeKey("")).toEqual({ kind: "missing", quoted: false });
    expect(describeStripeKey("not-a-key")).toEqual({ kind: "invalid", quoted: false });
  });

  it("keeps a quoted live key from being treated as a bare secret key", () => {
    expect(describeStripeKey(`"${secret}"`)).toEqual({ kind: "sk_live_", quoted: true });
  });
});

describe("stripe read probe", () => {
  it("reports price shape and a missing permission without the key or error text", async () => {
    process.env.STRIPE_PRICE_STARTER_ID = "price_starter_unit";
    process.env.STRIPE_PRICE_ID = "price_abo_unit";
    process.env.STRIPE_PRICE_PRO_ID = "price_pro_unit";
    const denied = Object.assign(new Error(`permission failed for ${secret}`), {
      type: "invalid_request_error",
      code: "more_permissions_required",
      statusCode: 403,
    });
    const stripe = {
      balance: { retrieve: async () => ({ livemode: true }) },
      prices: {
        retrieve: async (id: string) => ({
          livemode: true,
          active: true,
          currency: "eur",
          unit_amount: id.includes("starter") ? 900 : id.includes("abo") ? 2900 : 5900,
          recurring: { interval: "month", interval_count: 1 },
          product: { name: "PVNAVIGATOR_ Tarif" },
        }),
      },
      customers: { list: async () => { throw denied; } },
      checkout: { sessions: { list: async () => ({ data: [] }) } },
      subscriptions: { list: async () => ({ data: [] }) },
      invoices: { list: async () => ({ data: [] }) },
      billingPortal: { configurations: { list: async () => ({ data: [] }) } },
      webhookEndpoints: {
        list: async () => ({
          data: [
            {
              url: "https://pvnavigator.de/api/billing/webhook",
              livemode: true,
              status: "enabled",
              api_version: "2026-10-28.endive",
              enabled_events: Array.from({ length: 11 }, () => "event"),
            },
          ],
        }),
      },
    };

    const report = await inspectStripeAccess(stripe as never, true);
    const encoded = JSON.stringify(report);
    expect(report.account).toEqual({ ok: true, livemode: true, error: null });
    expect(report.prices.map((price) => [price.planKey, price.amount, price.matchesCatalog])).toEqual([
      ["pvnavigator_abo", 2900, true],
      ["pvnavigator_pro", 5900, true],
      ["pvnavigator_starter", 900, true],
    ]);
    expect(report.reads.customers).toBe("403:invalid_request_error:more_permissions_required");
    expect(report.reads.checkoutSessions).toBe("ok");
    expect(report.webhook).toMatchObject({ found: true, livemode: true, eventCount: 11 });
    expect(encoded).not.toContain(secret);
    expect(encoded).not.toContain("permission failed");
    expect(encoded).not.toContain("price_");
  });

  it("does not call Stripe for a publishable key", async () => {
    process.env.STRIPE_SECRET_KEY = "pk_live_unit_probe";
    const report = await probeProductionStripe();
    expect(report.direct).toEqual({ kind: "pk_live_", quoted: false });
    expect(report.runtime).toEqual({ kind: "pk_live_", quoted: false });
    expect(report.reads).toBeNull();
    expect(JSON.stringify(report)).not.toContain("pk_live_unit_probe");
  });
});
