import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionsCreate, configurationsList, configurationsCreate, tables, filters, user } = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  configurationsList: vi.fn(),
  configurationsCreate: vi.fn(),
  tables: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  filters: [] as Array<{ table: string; column: string; value: unknown }>,
  user: { current: { id: "user-1", email: "person@example.com" } as { id: string; email: string } | null },
}));

vi.mock("@/lib/billing/billingHttp", () => ({
  billingFormAllowed: vi.fn(() => true),
  redirectLoginForKonto: vi.fn(() => Response.redirect("http://127.0.0.1:3000/anmelden?next=/konto", 303)),
  redirectKonto: vi.fn((hint?: string) =>
    Response.redirect(`http://127.0.0.1:3000/konto${hint ? `?hinweis=${hint}` : ""}`, 303),
  ),
}));

vi.mock("@/lib/billing/stripeServer", () => ({
  getStripe: vi.fn(() => ({
    billingPortal: {
      sessions: { create: (...args: unknown[]) => sessionsCreate(...args) },
      configurations: {
        list: (...args: unknown[]) => configurationsList(...args),
        create: (...args: unknown[]) => configurationsCreate(...args),
      },
    },
  })),
}));

vi.mock("@/lib/auth", () => ({
  getServerUser: vi.fn(async () => user.current),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: vi.fn(() => ({
    from(table: string) {
      const result = tables[table] ?? { data: null, error: { message: "missing" } };
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push({ table, column, value });
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle: () => Promise.resolve(result),
        then: (
          onFulfilled: (value: typeof result) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(onFulfilled, onRejected),
      };
      return query;
    },
  })),
}));

import { INVOICE_PORTAL_PURPOSE } from "@/lib/billing/invoicePortal";

import { POST } from "./route";

function safeConfiguration(id = "bpc_invoices") {
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

function post(body?: FormData) {
  return POST(
    new Request("http://127.0.0.1:3000/api/billing/invoices", {
      method: "POST",
      body: body ?? undefined,
    }) as never,
  );
}

describe("POST /api/billing/invoices", () => {
  beforeEach(() => {
    sessionsCreate.mockReset();
    configurationsList.mockReset();
    configurationsCreate.mockReset();
    sessionsCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/session/test_invoices" });
    configurationsList.mockResolvedValue({ data: [safeConfiguration()], has_more: false });
    filters.length = 0;
    for (const key of Object.keys(tables)) delete tables[key];
    user.current = { id: "user-1", email: "person@example.com" };
    tables.stripe_customers = { data: { stripe_customer_id: "cus_123" }, error: null };
    tables.stripe_invoices = { data: [{ stripe_invoice_id: "in_1" }], error: null };
  });

  it("opens the invoice portal for a former subscriber and ignores a customer id from the browser", async () => {
    const body = new FormData();
    body.set("customer", "cus_other");
    body.set("stripe_customer_id", "cus_other");
    const response = await post(body);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://billing.stripe.com/p/session/test_invoices");
    expect(sessionsCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      configuration: "bpc_invoices",
      return_url: expect.stringMatching(/\/konto$/),
      locale: "de",
    });
    expect(configurationsList).toHaveBeenCalledWith(
      expect.objectContaining({ active: true, is_default: false }),
    );
    expect(configurationsCreate).not.toHaveBeenCalled();
    expect(filters).toEqual([
      { table: "stripe_customers", column: "user_id", value: "user-1" },
      { table: "stripe_invoices", column: "user_id", value: "user-1" },
    ]);
    expect(JSON.stringify(filters)).not.toContain("cus_other");
  });

  it("stays closed without invoices and without a stored customer", async () => {
    tables.stripe_invoices = { data: [], error: null };
    let response = await post();
    expect(response.headers.get("location")).toContain("hinweis=rechnungen-fehlen");
    expect(sessionsCreate).not.toHaveBeenCalled();

    sessionsCreate.mockClear();
    tables.stripe_invoices = { data: [{ stripe_invoice_id: "in_1" }], error: null };
    tables.stripe_customers = { data: null, error: null };
    response = await post();
    expect(response.headers.get("location")).toContain("hinweis=rechnungen-fehlen");
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(configurationsList).not.toHaveBeenCalled();
  });

  it("does not open a portal that can still change the subscription", async () => {
    const loosened = safeConfiguration();
    loosened.features.subscription_cancel.enabled = true;
    configurationsList.mockResolvedValue({ data: [loosened], has_more: false });
    const response = await post();
    expect(response.headers.get("location")).toContain("hinweis=rechnungen-fehler");
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(configurationsCreate).not.toHaveBeenCalled();
  });

  it("creates the invoice configuration before the first session", async () => {
    configurationsList.mockResolvedValue({ data: [], has_more: false });
    configurationsCreate.mockResolvedValue(safeConfiguration("bpc_created"));
    const response = await post();
    expect(response.headers.get("location")).toBe("https://billing.stripe.com/p/session/test_invoices");
    expect(configurationsCreate).toHaveBeenCalledOnce();
    const params = configurationsCreate.mock.calls[0]?.[0] as { features: { subscription_cancel: { enabled: boolean } } };
    expect(params.features.subscription_cancel.enabled).toBe(false);
    expect(params.features).toMatchObject({
      invoice_history: { enabled: true },
      subscription_update: { enabled: false, products: [] },
      payment_method_update: { enabled: false },
      customer_update: { enabled: false },
    });
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ configuration: "bpc_created", customer: "cus_123" }));
  });

  it("sends an anonymous visitor to the account login", async () => {
    user.current = null;
    const response = await post();
    expect(response.headers.get("location")).toContain("/anmelden?next=/konto");
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});
