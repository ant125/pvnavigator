import { describe, expect, it, vi } from "vitest";

import { canOpenBillingPortal, type AccessSummary } from "@/lib/accessSummary";
import {
  INVOICE_PORTAL_PURPOSE,
  canOpenInvoiceHistory,
  invoicePortalCreateParams,
  isInvoiceOnlyPortalConfiguration,
  resolveInvoiceHistoryConfiguration,
  type InvoicePortalConfiguration,
} from "@/lib/billing/invoicePortal";

function free(extra: Partial<Extract<AccessSummary, { kind: "free" }>> = {}): AccessSummary {
  return {
    kind: "free",
    freeAddressLabel: null,
    lastPeriodEnd: null,
    billingStatus: null,
    cancelAtPeriodEnd: false,
    canManagePortal: true,
    ...extra,
  };
}

function paid(planKey: string, billingStatus = "active"): AccessSummary {
  return {
    kind: "subscription",
    planKey,
    usedAddresses: 1,
    addressLimit: planKey === "pvnavigator_pro" ? 200 : 50,
    periodEnd: "2999-01-01T00:00:00.000Z",
    freeAddressLabel: null,
    scheduledPlanKey: null,
    scheduledEffectiveAt: null,
    billingStatus,
    cancelAtPeriodEnd: false,
    canManagePortal: true,
  };
}

function safeConfiguration(id = "bpc_invoices"): InvoicePortalConfiguration & {
  id: string;
  metadata: { purpose: string };
} {
  return {
    id,
    active: true,
    is_default: false,
    metadata: { purpose: INVOICE_PORTAL_PURPOSE },
    login_page: { enabled: false },
    features: {
      invoice_history: { enabled: true },
      customer_update: { enabled: false, allowed_updates: [] },
      payment_method_update: { enabled: false },
      subscription_cancel: {
        enabled: false,
        cancellation_reason: { enabled: false },
      },
      subscription_update: {
        enabled: false,
        default_allowed_updates: [],
        products: [],
      },
    },
  };
}

describe("invoice history access", () => {
  it.each([
    {
      name: "aktives ABO",
      summary: paid("pvnavigator_abo"),
      customerId: "cus_abo",
      invoices: 1,
      manage: true,
      history: true,
    },
    {
      name: "aktives PRO",
      summary: paid("pvnavigator_pro"),
      customerId: "cus_pro",
      invoices: 2,
      manage: true,
      history: true,
    },
    {
      name: "gekündigtes ABO im bezahlten Zeitraum",
      summary: paid("pvnavigator_abo", "canceled"),
      customerId: "cus_abo",
      invoices: 1,
      manage: true,
      history: true,
    },
    {
      name: "gekündigtes PRO im bezahlten Zeitraum",
      summary: paid("pvnavigator_pro", "canceled"),
      customerId: "cus_pro",
      invoices: 1,
      manage: true,
      history: true,
    },
    {
      name: "abgelaufenes ABO",
      summary: free({ billingStatus: "canceled", lastPeriodEnd: "2020-02-01T00:00:00.000Z" }),
      customerId: "cus_abo",
      invoices: 3,
      manage: false,
      history: true,
    },
    {
      name: "abgelaufenes PRO",
      summary: free({ billingStatus: "canceled", lastPeriodEnd: "2020-03-01T00:00:00.000Z" }),
      customerId: "cus_pro",
      invoices: 4,
      manage: false,
      history: true,
    },
    {
      name: "kostenloses Konto mit früheren Rechnungen",
      summary: free({ lastPeriodEnd: "2020-04-01T00:00:00.000Z", billingStatus: null }),
      customerId: "cus_old",
      invoices: 1,
      manage: false,
      history: true,
    },
    {
      name: "kostenloses Konto ohne Rechnungshistorie",
      summary: free({ canManagePortal: false }),
      customerId: null,
      invoices: 0,
      manage: false,
      history: false,
    },
    {
      name: "Stripe-Customer ohne Rechnung",
      summary: free(),
      customerId: "cus_empty",
      invoices: 0,
      manage: false,
      history: false,
    },
  ])("$name", ({ summary, customerId, invoices, manage, history }) => {
    expect(canOpenBillingPortal(summary)).toBe(manage);
    expect(canOpenInvoiceHistory(customerId, invoices)).toBe(history);
  });

  it("ignores a customer id that is only whitespace and a zero invoice count", () => {
    expect(canOpenInvoiceHistory("  ", 2)).toBe(false);
    expect(canOpenInvoiceHistory("cus_123", 0)).toBe(false);
  });
});

describe("invoice-only portal configuration", () => {
  it("requests invoice history and switches the other portal features off", () => {
    const params = invoicePortalCreateParams();
    expect(params.metadata).toEqual({ purpose: INVOICE_PORTAL_PURPOSE });
    expect(params.login_page).toEqual({ enabled: false });
    expect(params.features.invoice_history).toEqual({ enabled: true });
    expect(params.features.customer_update).toEqual({ enabled: false, allowed_updates: [] });
    expect(params.features.payment_method_update).toEqual({ enabled: false });
    expect(params.features.subscription_cancel).toEqual({ enabled: false });
    expect(params.features.subscription_update).toEqual({
      enabled: false,
      default_allowed_updates: [],
      products: [],
    });
    expect(params).not.toHaveProperty("flow_data");
    expect(isInvoiceOnlyPortalConfiguration(safeConfiguration())).toBe(true);
  });

  it("rejects the dashboard default and every subscription or customer edit", () => {
    const safe = safeConfiguration();
    expect(isInvoiceOnlyPortalConfiguration({ ...safe, is_default: true })).toBe(false);
    expect(isInvoiceOnlyPortalConfiguration({ ...safe, active: false })).toBe(false);
    expect(isInvoiceOnlyPortalConfiguration({ ...safe, login_page: { enabled: true } })).toBe(false);
    expect(
      isInvoiceOnlyPortalConfiguration({
        ...safe,
        features: { ...safe.features, invoice_history: { enabled: false } },
      }),
    ).toBe(false);
    expect(
      isInvoiceOnlyPortalConfiguration({
        ...safe,
        features: {
          ...safe.features,
          customer_update: { enabled: true, allowed_updates: ["email"] },
        },
      }),
    ).toBe(false);
    expect(
      isInvoiceOnlyPortalConfiguration({
        ...safe,
        features: { ...safe.features, payment_method_update: { enabled: true } },
      }),
    ).toBe(false);
    expect(
      isInvoiceOnlyPortalConfiguration({
        ...safe,
        features: {
          ...safe.features,
          subscription_cancel: { enabled: true, cancellation_reason: { enabled: false } },
        },
      }),
    ).toBe(false);
    expect(
      isInvoiceOnlyPortalConfiguration({
        ...safe,
        features: {
          ...safe.features,
          subscription_update: {
            enabled: true,
            default_allowed_updates: ["price"],
            products: [{ product: "prod_abo", prices: ["price_abo"] }],
          },
        },
      }),
    ).toBe(false);
  });
});

describe("resolveInvoiceHistoryConfiguration", () => {
  it("reuses an existing invoice-only configuration and does not create another", async () => {
    const create = vi.fn();
    const id = await resolveInvoiceHistoryConfiguration({
      billingPortal: {
        configurations: {
          list: async () => ({ data: [safeConfiguration("bpc_existing")], has_more: false }),
          create,
        },
      },
    });
    expect(id).toBe("bpc_existing");
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the configuration when none exists and refuses an unsafe echo", async () => {
    const created = safeConfiguration("bpc_new");
    const create = vi.fn(async () => created);
    const id = await resolveInvoiceHistoryConfiguration({
      billingPortal: {
        configurations: {
          list: async () => ({ data: [], has_more: false }),
          create,
        },
      },
    });
    expect(id).toBe("bpc_new");
    expect(create).toHaveBeenCalledWith(invoicePortalCreateParams());

    const unsafe = safeConfiguration("bpc_open");
    unsafe.features.subscription_cancel.enabled = true;
    const refused = await resolveInvoiceHistoryConfiguration({
      billingPortal: {
        configurations: {
          list: async () => ({ data: [], has_more: false }),
          create: async () => unsafe,
        },
      },
    });
    expect(refused).toBeNull();
  });

  it("does not replace an owned configuration that can cancel or switch plans", async () => {
    const loosened = safeConfiguration("bpc_loosened");
    loosened.features.subscription_update.enabled = true;
    loosened.features.subscription_update.products = [{ product: "prod_abo" }];
    const create = vi.fn();
    const id = await resolveInvoiceHistoryConfiguration({
      billingPortal: {
        configurations: {
          list: async () => ({ data: [loosened], has_more: false }),
          create,
        },
      },
    });
    expect(id).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("finds the configuration on a later page and never lists the dashboard default", async () => {
    const calls: Array<{ is_default?: boolean; starting_after?: string }> = [];
    const id = await resolveInvoiceHistoryConfiguration({
      billingPortal: {
        configurations: {
          async list(params) {
            calls.push({ is_default: params.is_default, starting_after: params.starting_after });
            if (!params.starting_after) {
              return {
                data: [{ ...safeConfiguration("bpc_other"), metadata: { purpose: "other" } }],
                has_more: true,
              };
            }
            return { data: [safeConfiguration("bpc_page2")], has_more: false };
          },
          create: async () => safeConfiguration("bpc_should_not_create"),
        },
      },
    });
    expect(id).toBe("bpc_page2");
    expect(calls).toEqual([
      { is_default: false, starting_after: undefined },
      { is_default: false, starting_after: "bpc_other" },
    ]);
  });
});
