import { describe, expect, it } from "vitest";

import {
  commandPayload,
  isStripeRedirectUrl,
  normalizeCheckoutSession,
  normalizeFailedInvoice,
  normalizePaidInvoice,
  normalizeSubscription,
  type AllowedPrice,
} from "./stripeEvents";

const USER = "11111111-1111-4111-8111-111111111111";
const PRICE = "price_monthly";
const CATALOG: AllowedPrice[] = [
  { priceId: PRICE, amount: 2900, currency: "eur", planKey: "pvnavigator_abo", addressLimit: 50 },
  { priceId: "price_pro", amount: 5900, currency: "eur", planKey: "pvnavigator_pro", addressLimit: 200 },
];

const PERIOD = { start: 1_760_000_000, end: 1_762_592_000 };

function paidInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "in_1",
    object: "invoice",
    amount_paid: 2900,
    currency: "eur",
    billing_reason: "subscription_create",
    customer: "cus_1",
    status: "paid",
    parent: {
      type: "subscription_details",
      subscription_details: {
        subscription: "sub_1",
        metadata: { user_id: USER },
      },
    },
    lines: {
      data: [
        {
          id: "il_1",
          period: PERIOD,
          pricing: {
            type: "price_details",
            price_details: { price: PRICE, product: "prod_1" },
          },
          parent: {
            type: "subscription_item_details",
            subscription_item_details: { proration: false },
          },
        },
      ],
    },
    ...overrides,
  };
}

describe("normalizePaidInvoice", () => {
  it("uses the invoice line service period for the monthly price", () => {
    const result = normalizePaidInvoice(paidInvoice(), CATALOG, USER);
    expect(result.status).toBe("command");
    if (result.status !== "command" || result.command.action !== "invoice_paid") {
      throw new Error("expected invoice_paid");
    }
    expect(result.command.periodStart).toBe(new Date(PERIOD.start * 1000).toISOString());
    expect(result.command.periodEnd).toBe(new Date(PERIOD.end * 1000).toISOString());
    expect(result.command.amountPaid).toBe(2900);
    expect(result.command.priceId).toBe(PRICE);
    expect(result.command.allowedPrices).toEqual(CATALOG);
    expect(result.command.subscriptionId).toBe("sub_1");
    expect(result.command.replacesSubscriptionId).toBeNull();
  });

  it("reads the invoice fields shared by API 2026-09-30.endive and 2026-10-28.endive", () => {
    const current = normalizePaidInvoice(
      paidInvoice({ livemode: true }),
      CATALOG,
      USER,
    );
    const legacy = normalizePaidInvoice(
      {
        id: "in_legacy",
        amount_paid: 2900,
        currency: "eur",
        billing_reason: "subscription_cycle",
        customer: "cus_1",
        subscription: "sub_1",
        livemode: false,
        lines: {
          data: [
            {
              period: PERIOD,
              price: PRICE,
            },
          ],
        },
      },
      CATALOG,
      USER,
    );
    for (const result of [current, legacy]) {
      expect(result.status).toBe("command");
      if (result.status !== "command" || result.command.action !== "invoice_paid") {
        throw new Error("expected invoice_paid");
      }
      expect(result.command.priceId).toBe(PRICE);
      expect(result.command.subscriptionId).toBe("sub_1");
      expect(result.command.amountPaid).toBe(2900);
    }
  });

  it("carries an ABO subscription id from Checkout metadata and ignores anything else", () => {
    const withMeta = normalizePaidInvoice(
      paidInvoice({
        parent: {
          type: "subscription_details",
          subscription_details: {
            subscription: "sub_pro",
            metadata: { user_id: USER, replaces_subscription_id: "sub_AboOld1" },
          },
        },
      }),
      CATALOG,
      USER,
    );
    const fromInvoice = normalizePaidInvoice(
      paidInvoice({ metadata: { replaces_subscription_id: "sub_FromInvoice1" } }),
      CATALOG,
      USER,
    );
    const rejected = normalizePaidInvoice(
      paidInvoice({ metadata: { replaces_subscription_id: "not-a-subscription" } }),
      CATALOG,
      USER,
    );
    if (withMeta.status !== "command" || withMeta.command.action !== "invoice_paid") {
      throw new Error("expected invoice_paid");
    }
    if (fromInvoice.status !== "command" || fromInvoice.command.action !== "invoice_paid") {
      throw new Error("expected invoice_paid");
    }
    if (rejected.status !== "command" || rejected.command.action !== "invoice_paid") {
      throw new Error("expected invoice_paid");
    }
    expect(withMeta.command.replacesSubscriptionId).toBe("sub_AboOld1");
    expect(fromInvoice.command.replacesSubscriptionId).toBe("sub_FromInvoice1");
    expect(rejected.command.replacesSubscriptionId).toBeNull();
    expect(commandPayload(withMeta.command)).toMatchObject({
      action: "invoice_paid",
      replaces_subscription_id: "sub_AboOld1",
    });
  });

  it("selects the PRO price without treating 59 € on the ABO price as that plan", () => {
    const pro = normalizePaidInvoice(
      paidInvoice({
        amount_paid: 5900,
        lines: {
          data: [
            {
              period: PERIOD,
              pricing: { price_details: { price: "price_pro" } },
              parent: { subscription_item_details: { proration: false } },
            },
          ],
        },
      }),
      CATALOG,
      USER,
    );
    expect(pro.status).toBe("command");
    if (pro.status !== "command" || pro.command.action !== "invoice_paid") throw new Error("expected invoice");
    expect(pro.command.priceId).toBe("price_pro");
    expect(pro.command.amountPaid).toBe(5900);

    const mismatched = normalizePaidInvoice(paidInvoice({ amount_paid: 5900 }), CATALOG, USER);
    if (mismatched.status !== "command" || mismatched.command.action !== "invoice_paid") {
      throw new Error("expected invoice");
    }
    expect(mismatched.command.priceId).toBe(PRICE);
    expect(mismatched.command.amountPaid).toBe(5900);
    expect(mismatched.command.allowedPrices[0]?.amount).toBe(2900);
  });

  it("does not treat a one-time 7 € invoice as the subscription", () => {
    const result = normalizePaidInvoice(
      paidInvoice({
        id: "in_once",
        amount_paid: 700,
        billing_reason: "manual",
        parent: null,
        lines: {
          data: [
            {
              period: { start: PERIOD.start, end: PERIOD.start },
              pricing: { price_details: { price: "price_once" } },
            },
          ],
        },
      }),
      CATALOG,
      USER,
    );
    expect(result.status).toBe("command");
    if (result.status !== "command" || result.command.action !== "invoice_paid") {
      throw new Error("expected a rejected invoice command");
    }
    expect(result.command.subscriptionId).toBe("");
    expect(result.command.amountPaid).toBe(700);
  });

  it("asks for a retrieve when the subscription line period is missing", () => {
    const result = normalizePaidInvoice(
      paidInvoice({ lines: { data: [] } }),
      CATALOG,
      USER,
    );
    expect(result).toEqual({ status: "incomplete", reason: "invoice_lines" });
  });

  it("ignores a proration update and does not invent a new period", () => {
    const result = normalizePaidInvoice(
      paidInvoice({
        billing_reason: "subscription_update",
        lines: {
          data: [
            {
              period: PERIOD,
              pricing: { price_details: { price: PRICE } },
              parent: { subscription_item_details: { proration: true } },
            },
          ],
        },
      }),
      CATALOG,
      USER,
    );
    expect(result.status).toBe("command");
    if (result.status !== "command" || result.command.action !== "invoice_paid") {
      throw new Error("expected invoice_paid");
    }
    expect(result.command.billingReason).toBe("subscription_update");
    expect(result.command.periodStart).toBe("");
  });
});

describe("normalizeFailedInvoice", () => {
  it("records the failure without a period payload", () => {
    expect(
      normalizeFailedInvoice(
        { id: "in_fail", customer: "cus_1", billing_reason: "subscription_cycle", parent: { subscription_details: { subscription: "sub_1" } } },
        USER,
      ),
    ).toMatchObject({ action: "invoice_failed", invoiceId: "in_fail", subscriptionId: "sub_1" });
  });
});

describe("normalizeSubscription", () => {
  it("reads the item period and an explicit cancel-at-period-end flag", () => {
    const command = normalizeSubscription(
      {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        cancel_at_period_end: true,
        cancel_at: PERIOD.end,
        latest_invoice: "in_1",
        metadata: { user_id: USER },
        items: {
          data: [
            {
              current_period_start: PERIOD.start,
              current_period_end: PERIOD.end,
              price: { id: PRICE },
            },
          ],
        },
      },
      1_760_000_100,
      USER,
      CATALOG,
    );
    expect(command).toMatchObject({
      action: "sync_subscription",
      status: "active",
      cancelAtPeriodEnd: true,
      eventCreated: 1_760_000_100,
      priceId: PRICE,
    });
  });
});

describe("normalizeCheckoutSession", () => {
  it("only links the customer and does not grant a period", () => {
    expect(
      normalizeCheckoutSession({
        mode: "subscription",
        client_reference_id: USER,
        customer: "cus_1",
        metadata: { user_id: USER },
        payment_status: "paid",
      }),
    ).toEqual({ action: "link_customer", userId: USER, customerId: "cus_1" });
  });

  it("refuses a session whose metadata user does not match the reference", () => {
    expect(
      normalizeCheckoutSession({
        mode: "subscription",
        client_reference_id: USER,
        customer: "cus_1",
        metadata: { user_id: "22222222-2222-4222-8222-222222222222" },
      }),
    ).toMatchObject({ action: "ignore", reason: "session_user_mismatch" });
  });
});

describe("isStripeRedirectUrl", () => {
  it("allows only the hosted Checkout and Portal hosts", () => {
    expect(isStripeRedirectUrl("https://checkout.stripe.com/c/pay/cs_test", "checkout")).toBe(true);
    expect(isStripeRedirectUrl("https://billing.stripe.com/p/session/test", "portal")).toBe(true);
    expect(isStripeRedirectUrl("https://evil.example/checkout.stripe.com", "checkout")).toBe(false);
    expect(isStripeRedirectUrl("http://checkout.stripe.com/c/pay/cs_test", "checkout")).toBe(false);
  });
});
