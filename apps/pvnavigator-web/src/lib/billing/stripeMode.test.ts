import { afterEach, describe, expect, it } from "vitest";

import {
  BillingPriceError,
  assertPlanPrice,
  expectedLivemode,
  getStripe,
  getWebhookSecret,
  LIVE_CHECKOUT_ACCOUNT_ID,
  liveCheckoutAllowed,
  loadPriceCatalog,
  stripeRuntimeMode,
} from "./stripeServer";

const NAMES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER_ID",
  "STRIPE_PRICE_ID",
  "STRIPE_PRICE_PRO_ID",
] as const;

const previous = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));

function setEnv(values: Partial<Record<(typeof NAMES)[number], string | undefined>>) {
  for (const name of NAMES) {
    if (!(name in values)) continue;
    const value = values[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function price(livemode: boolean, amount = 900) {
  return {
    id: "price_starter",
    livemode,
    active: true,
    currency: "eur",
    unit_amount: amount,
    recurring: { interval: "month", interval_count: 1 },
    product: { name: "PVNAVIGATOR_ STARTER" },
  };
}

afterEach(() => {
  for (const name of NAMES) {
    const value = previous[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("live checkout gate", () => {
  it("keeps sandbox checkout open and limits live checkout to one account", () => {
    setEnv({ STRIPE_SECRET_KEY: "rk_test_local" });
    expect(liveCheckoutAllowed("11111111-1111-4111-8111-111111111111")).toBe(true);

    setEnv({ STRIPE_SECRET_KEY: "rk_live_local" });
    expect(liveCheckoutAllowed(LIVE_CHECKOUT_ACCOUNT_ID)).toBe(true);
    expect(liveCheckoutAllowed("11111111-1111-4111-8111-111111111111")).toBe(false);
    expect(liveCheckoutAllowed("")).toBe(false);

    setEnv({ STRIPE_SECRET_KEY: "sk_live_local" });
    expect(liveCheckoutAllowed(LIVE_CHECKOUT_ACCOUNT_ID)).toBe(true);
    expect(liveCheckoutAllowed("11111111-1111-4111-8111-111111111111")).toBe(false);
  });
});

describe("stripe mode", () => {
  it("accepts secret and restricted keys and keeps every other key closed", () => {
    expect(stripeRuntimeMode("sk_test_local")).toBe("test");
    expect(stripeRuntimeMode("rk_test_local")).toBe("test");
    expect(stripeRuntimeMode("sk_live_local")).toBe("live");
    expect(stripeRuntimeMode("rk_live_local")).toBe("live");
    expect(stripeRuntimeMode("pk_live_local")).toBeNull();
    expect(stripeRuntimeMode("pk_test_local")).toBeNull();
    expect(stripeRuntimeMode('"rk_live_local"')).toBeNull();
    expect(stripeRuntimeMode("sk_secret")).toBeNull();
    expect(stripeRuntimeMode("")).toBeNull();

    setEnv({ STRIPE_SECRET_KEY: "rk_test_local" });
    expect(expectedLivemode()).toBe(false);
    expect(getStripe()).not.toBeNull();

    setEnv({ STRIPE_SECRET_KEY: "rk_live_local" });
    expect(expectedLivemode()).toBe(true);
    expect(getStripe()).not.toBeNull();

    setEnv({ STRIPE_SECRET_KEY: "pk_live_local" });
    expect(expectedLivemode()).toBeNull();
    expect(getStripe()).toBeNull();
  });

  it("accepts a webhook secret from either mode and rejects any other value", () => {
    setEnv({ STRIPE_WEBHOOK_SECRET: "whsec_local" });
    expect(getWebhookSecret()).toBe("whsec_local");
    setEnv({ STRIPE_WEBHOOK_SECRET: "not-a-webhook-secret" });
    expect(getWebhookSecret()).toBeNull();
  });

  it("rejects a price from the other mode, a wrong amount, and a duplicated price id", async () => {
    setEnv({
      STRIPE_SECRET_KEY: "sk_live_local",
      STRIPE_PRICE_STARTER_ID: "price_starter",
      STRIPE_PRICE_ID: "price_abo",
      STRIPE_PRICE_PRO_ID: "price_pro",
    });
    getStripe();
    const stripe = {
      prices: {
        retrieve: async () => price(true),
      },
    };
    await expect(assertPlanPrice(stripe as never, "starter")).resolves.toMatchObject({
      amount: 900,
      planKey: "pvnavigator_starter",
    });

    setEnv({ STRIPE_SECRET_KEY: "sk_test_local" });
    getStripe();
    const otherMode = { prices: { retrieve: async () => price(true) } };
    await expect(assertPlanPrice(otherMode as never, "starter")).rejects.toBeInstanceOf(BillingPriceError);

    setEnv({ STRIPE_SECRET_KEY: "sk_live_local" });
    getStripe();
    const wrongAmount = { prices: { retrieve: async () => price(true, 2900) } };
    await expect(assertPlanPrice(wrongAmount as never, "starter")).rejects.toBeInstanceOf(BillingPriceError);

    setEnv({ STRIPE_PRICE_ID: "price_starter" });
    expect(() => loadPriceCatalog()).toThrow(BillingPriceError);
  });
});
