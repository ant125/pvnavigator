import { describe, expect, it } from "vitest";

import { VAT_EXEMPTION_LABEL } from "@pv-access/core";

import {
  checkoutInvoiceCollection,
  existingStripeCustomerInvoiceParams,
  initialCheckoutSession,
  newStripeCustomerParams,
} from "./checkoutInvoice";

const USER = "11111111-1111-4111-8111-111111111111";
const LABEL = VAT_EXEMPTION_LABEL;

function countLabel(value: unknown): number {
  return JSON.stringify(value).split(LABEL).length - 1;
}

describe("checkout invoice collection", () => {
  it("requires the full name and billing address and leaves company and tax id optional", () => {
    const collection = checkoutInvoiceCollection();

    expect(collection.locale).toBe("de");
    expect(collection.automatic_tax).toEqual({ enabled: false });
    expect(collection.billing_address_collection).toBe("required");
    expect(collection.name_collection).toEqual({
      individual: { enabled: true, optional: false },
      business: { enabled: true, optional: true },
    });
    expect(collection.customer_update).toEqual({ name: "auto", address: "auto" });
    expect(collection.customer_update).not.toHaveProperty("shipping");
    expect(collection.tax_id_collection).toEqual({ enabled: true, required: "never" });
  });

  it("stores German invoice preferences and the §19 footer once on a new customer", () => {
    const params = newStripeCustomerParams({ userId: USER, email: "person@example.com" });

    expect(params).toEqual({
      email: "person@example.com",
      metadata: { user_id: USER },
      preferred_locales: ["de"],
      invoice_settings: { footer: LABEL },
    });
    expect(countLabel(params)).toBe(1);
    expect(params).not.toHaveProperty("address");
    expect(params).not.toHaveProperty("name");
  });

  it("refreshes only locale and footer on an existing customer", () => {
    const params = existingStripeCustomerInvoiceParams();

    expect(params).toEqual({
      preferred_locales: ["de"],
      invoice_settings: { footer: LABEL },
    });
    expect(params).not.toHaveProperty("name");
    expect(params).not.toHaveProperty("individual_name");
    expect(params).not.toHaveProperty("business_name");
    expect(params).not.toHaveProperty("address");
    expect(params).not.toHaveProperty("tax");
    expect(params.invoice_settings).not.toHaveProperty("custom_fields");
    expect(countLabel(params)).toBe(1);
  });
});

describe("initial checkout session", () => {
  const plans = [
    { planKey: "pvnavigator_starter", label: "STARTER", priceId: "price_starter", priceLabel: "9 €" },
    { planKey: "pvnavigator_abo", label: "ABO", priceId: "price_abo", priceLabel: "29 €" },
    { planKey: "pvnavigator_pro", label: "PRO", priceId: "price_pro", priceLabel: "59 €" },
  ] as const;

  it.each(plans)("sells $label at the server price and collects invoice details", (plan) => {
    const session = initialCheckoutSession({
      userId: USER,
      customerId: "cus_existing",
      priceId: plan.priceId,
      planKey: plan.planKey,
      label: plan.label,
      origin: "https://pvnavigator.de",
      submitMessage: `${LABEL} ${plan.priceLabel} pro Monat ist der Endpreis.`,
    });

    expect(session.mode).toBe("subscription");
    expect(session.customer).toBe("cus_existing");
    expect(session.line_items).toEqual([{ price: plan.priceId, quantity: 1 }]);
    expect(session).not.toHaveProperty("amount");
    expect(session.metadata).toEqual({ user_id: USER, plan_key: plan.planKey });
    expect(session.subscription_data?.metadata).toEqual(session.metadata);
    expect(session.subscription_data?.description).toBe(`PVNAVIGATOR_ ${plan.label}`);
    expect(session).toMatchObject(checkoutInvoiceCollection());
    expect(session).not.toHaveProperty("shipping_address_collection");
    expect(session.subscription_data).not.toHaveProperty("invoice_settings");
    expect(countLabel(session)).toBe(1);
    const submit = session.custom_text?.submit;
    expect(submit && typeof submit === "object" ? submit.message : null).toBe(
      `${LABEL} ${plan.priceLabel} pro Monat ist der Endpreis.`,
    );
  });
});
