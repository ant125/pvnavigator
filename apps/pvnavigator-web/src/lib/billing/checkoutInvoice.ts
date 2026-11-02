import { VAT_EXEMPTION_LABEL } from "@pv-access/core";
import type Stripe from "stripe";

/**
 * Invoice identity collected on every new Checkout Session.
 *
 * The full name is required (`optional: false`). The company name can be left
 * blank. Stripe stores `individual_name` and `business_name` on the Customer
 * and sets `customer.name` to the company name when one was entered, otherwise
 * to the person's name. `customer_update` writes that name and the billing
 * address onto the existing Customer so the next subscription invoice can use
 * them. Already finalized invoices keep the snapshot taken when they were
 * issued. Tax is not calculated: the Price is the final amount.
 */
export function checkoutInvoiceCollection(): Pick<
  Stripe.Checkout.SessionCreateParams,
  | "automatic_tax"
  | "billing_address_collection"
  | "customer_update"
  | "locale"
  | "name_collection"
  | "tax_id_collection"
> {
  return {
    locale: "de",
    automatic_tax: { enabled: false },
    billing_address_collection: "required",
    name_collection: {
      individual: { enabled: true, optional: false },
      business: { enabled: true, optional: true },
    },
    customer_update: {
      name: "auto",
      address: "auto",
    },
    tax_id_collection: {
      enabled: true,
      required: "never",
    },
  };
}

/**
 * A Customer created for the first Checkout.
 * `preferred_locales` selects German for later invoice emails and hosted
 * invoice pages. It does not rewrite an invoice that Stripe has already issued.
 * The §19 notice lives only in this footer, which replaces an account-level
 * default footer instead of being appended to it.
 */
export function newStripeCustomerParams(args: {
  userId: string;
  email: string | null | undefined;
}): Stripe.CustomerCreateParams {
  return {
    email: args.email ?? undefined,
    metadata: { user_id: args.userId },
    preferred_locales: ["de"],
    invoice_settings: { footer: VAT_EXEMPTION_LABEL },
  };
}

/**
 * Locale and the single §19 footer for a Customer that already exists.
 * Name, address and tax IDs are left untouched here. Checkout prefills them
 * and saves any correction through `customer_update`.
 */
export function existingStripeCustomerInvoiceParams(): Stripe.CustomerUpdateParams {
  return {
    preferred_locales: ["de"],
    invoice_settings: { footer: VAT_EXEMPTION_LABEL },
  };
}

/** First purchase of STARTER, ABO or PRO. The price id comes from the server catalog. */
export function initialCheckoutSession(args: {
  userId: string;
  customerId: string;
  priceId: string;
  planKey: string;
  label: string;
  origin: string;
  submitMessage: string;
}): Stripe.Checkout.SessionCreateParams {
  const metadata = { user_id: args.userId, plan_key: args.planKey };
  return {
    mode: "subscription",
    customer: args.customerId,
    client_reference_id: args.userId,
    success_url: `${args.origin}/tarife/erfolg?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.origin}/tarife/abgebrochen`,
    line_items: [{ price: args.priceId, quantity: 1 }],
    metadata,
    custom_text: { submit: { message: args.submitMessage } },
    subscription_data: {
      description: `PVNAVIGATOR_ ${args.label}`,
      metadata,
    },
    ...checkoutInvoiceCollection(),
  };
}
