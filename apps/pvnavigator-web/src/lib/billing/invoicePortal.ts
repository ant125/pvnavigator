import type Stripe from "stripe";

/**
 * Invoice history uses its own Customer Portal configuration.
 * The Dashboard default stays untouched: that default can cancel a subscription.
 * A session is opened only after Stripe echoes this configuration back with
 * every subscription, payment-method and customer edit switched off.
 */
export const INVOICE_PORTAL_PURPOSE = "pvn_invoice_history";

export const INVOICE_HISTORY_HINTS: Record<string, string> = {
  "rechnungen-fehlen": "Für dieses Konto liegen keine Rechnungen vor.",
  "rechnungen-fehler":
    "Die Rechnungen konnten nicht geöffnet werden. Ihr Zugang ist unverändert.",
};

/** A stored customer and at least one recorded invoice. Subscription status is irrelevant. */
export function canOpenInvoiceHistory(customerId: string | null, invoiceCount: number): boolean {
  return typeof customerId === "string" && customerId.trim().length > 0 && invoiceCount > 0;
}

export type InvoicePortalConfiguration = {
  active: boolean;
  is_default: boolean;
  login_page: { enabled: boolean } | null;
  features: {
    invoice_history: { enabled: boolean };
    customer_update: { enabled: boolean; allowed_updates: readonly string[] };
    payment_method_update: { enabled: boolean };
    subscription_cancel: {
      enabled: boolean;
      cancellation_reason: { enabled: boolean };
    };
    subscription_update: {
      enabled: boolean;
      default_allowed_updates: readonly string[];
      products?: readonly unknown[] | null;
    };
  };
};

/** True only for a non-default portal that can show invoices and nothing else we bill for. */
export function isInvoiceOnlyPortalConfiguration(config: InvoicePortalConfiguration): boolean {
  const { features } = config;
  const products = features.subscription_update.products;
  return (
    config.active &&
    config.is_default === false &&
    config.login_page?.enabled === false &&
    features.invoice_history.enabled === true &&
    features.customer_update.enabled === false &&
    features.customer_update.allowed_updates.length === 0 &&
    features.payment_method_update.enabled === false &&
    features.subscription_cancel.enabled === false &&
    features.subscription_cancel.cancellation_reason.enabled === false &&
    features.subscription_update.enabled === false &&
    features.subscription_update.default_allowed_updates.length === 0 &&
    (products == null || products.length === 0)
  );
}

export function invoicePortalCreateParams(): Stripe.BillingPortal.ConfigurationCreateParams {
  return {
    name: "PVNAVIGATOR_ Rechnungen",
    metadata: { purpose: INVOICE_PORTAL_PURPOSE },
    business_profile: { headline: "Ihre PVNAVIGATOR_-Rechnungen" },
    login_page: { enabled: false },
    features: {
      invoice_history: { enabled: true },
      customer_update: { enabled: false, allowed_updates: [] },
      payment_method_update: { enabled: false },
      subscription_cancel: { enabled: false },
      subscription_update: {
        enabled: false,
        default_allowed_updates: [],
        products: [],
      },
    },
  };
}

type ListedConfiguration = InvoicePortalConfiguration & {
  id: string;
  metadata: { [key: string]: string } | null;
};

export type InvoiceHistoryPortalClient = {
  billingPortal: {
    configurations: {
      list(params: {
        active?: boolean;
        is_default?: boolean;
        limit?: number;
        starting_after?: string;
      }): Promise<{ data: ListedConfiguration[]; has_more: boolean }>;
      create(params: Stripe.BillingPortal.ConfigurationCreateParams): Promise<ListedConfiguration>;
    };
  };
};

const PAGE_LIMIT = 100;
const MAX_PAGES = 10;

/**
 * Reuses the invoice-only configuration, or creates it once.
 * An owned configuration that is no longer invoice-only is refused.
 * The Dashboard default configuration is never selected and never updated.
 */
export async function resolveInvoiceHistoryConfiguration(
  stripe: InvoiceHistoryPortalClient,
): Promise<string | null> {
  const owned: ListedConfiguration[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const listed = await stripe.billingPortal.configurations.list({
      active: true,
      is_default: false,
      limit: PAGE_LIMIT,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    owned.push(
      ...listed.data.filter((row) => row.metadata?.purpose === INVOICE_PORTAL_PURPOSE),
    );
    const last = listed.data.at(-1);
    if (!listed.has_more || !last) {
      const safe = owned.find((row) => isInvoiceOnlyPortalConfiguration(row));
      if (safe) return safe.id;
      if (owned.length > 0) return null;
      const created = await stripe.billingPortal.configurations.create(invoicePortalCreateParams());
      return isInvoiceOnlyPortalConfiguration(created) ? created.id : null;
    }
    startingAfter = last.id;
  }
  return null;
}
