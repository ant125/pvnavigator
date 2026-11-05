import { afterEach, describe, expect, it } from "vitest";

import { buildLiveBillingReport } from "./liveBillingReport";

const previous = {
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_STARTER_ID: process.env.STRIPE_PRICE_STARTER_ID,
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
  STRIPE_PRICE_PRO_ID: process.env.STRIPE_PRICE_PRO_ID,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
};

afterEach(() => {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("live billing report", () => {
  it("keeps keys and price ids out of the summary", async () => {
    const payload = Buffer.from(
      JSON.stringify({ role: "service_role", ref: "ftxgcpebzrhvifjnjivm" }),
    ).toString("base64url");
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit_secret";
    process.env.STRIPE_PRICE_STARTER_ID = "price_starter_unit";
    process.env.STRIPE_PRICE_ID = "price_abo_unit";
    process.env.STRIPE_PRICE_PRO_ID = "price_pro_unit";
    process.env.SUPABASE_SERVICE_ROLE_KEY = `header.${payload}.signature`;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ftxgcpebzrhvifjnjivm.supabase.co";

    const stripe = {
      prices: {
        retrieve: async (id: string) => ({
          id,
          livemode: true,
          active: true,
          currency: "eur",
          unit_amount: id.includes("starter") ? 900 : id.includes("abo") ? 2900 : 5900,
          recurring: { interval: "month", interval_count: 1 },
          product: { name: "PVNAVIGATOR_ Tarif" },
        }),
      },
      webhookEndpoints: {
        list: async () => ({
          data: [
            {
              url: "https://pvnavigator.de/api/billing/webhook",
              livemode: true,
              status: "enabled",
              api_version: "2026-10-28.endive",
              enabled_events: Array.from({ length: 11 }, (_, index) => `event.${index}`),
            },
          ],
        }),
      },
    };

    const report = await buildLiveBillingReport(stripe as never);
    const encoded = JSON.stringify(report);
    expect(report.webhookSecretShape).toBe(true);
    expect(report.serviceRole).toEqual({ production: true, role: "service_role" });
    expect(report.prices.map((price) => [price.planKey, price.amount])).toEqual([
      ["pvnavigator_abo", 2900],
      ["pvnavigator_pro", 5900],
      ["pvnavigator_starter", 900],
    ]);
    expect(report.webhook).toMatchObject({ found: true, livemode: true, eventCount: 11 });
    expect(encoded).not.toContain("whsec_");
    expect(encoded).not.toContain("price_");
    expect(encoded).not.toContain("signature");
  });
});
