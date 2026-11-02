import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionsCreate, tables, filters } = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  tables: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  filters: [] as Array<{ table: string; column: string; value: unknown }>,
}));

vi.mock("@/lib/billing/billingHttp", () => ({
  billingFormAllowed: vi.fn(() => true),
  redirectLoginForTariff: vi.fn(() => Response.redirect("http://127.0.0.1:3000/anmelden", 303)),
  redirectTarife: vi.fn((hint?: string) =>
    Response.redirect(`http://127.0.0.1:3000/tarife${hint ? `?hinweis=${hint}` : ""}`, 303),
  ),
}));

vi.mock("@/lib/billing/stripeServer", () => ({
  getStripe: vi.fn(() => ({
    billingPortal: {
      sessions: {
        create: (...args: unknown[]) => sessionsCreate(...args),
      },
    },
  })),
}));

vi.mock("@/lib/auth", () => ({
  getServerUser: vi.fn(async () => ({ id: "user-1", email: "person@example.com" })),
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

import { POST } from "./route";

function customer(id: string | null = "cus_123") {
  tables.stripe_customers = {
    data: id ? { stripe_customer_id: id } : null,
    error: null,
  };
}

function periods(rows: Array<Record<string, unknown>>) {
  tables.subscription_periods = { data: rows, error: null };
}

function subscriptions(rows: Array<Record<string, unknown>>) {
  tables.stripe_subscriptions = { data: rows, error: null };
}

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    sessionsCreate.mockReset();
    sessionsCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/session/test_123" });
    filters.length = 0;
    for (const key of Object.keys(tables)) delete tables[key];
    customer();
    periods([]);
    subscriptions([]);
  });

  it("does not open the portal for a Stripe customer without a manageable subscription", async () => {
    const response = await POST(new Request("http://127.0.0.1:3000/api/billing/portal", { method: "POST" }) as never);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("hinweis=portal-fehlt");
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(filters).toEqual(
      expect.arrayContaining([
        { table: "stripe_customers", column: "user_id", value: "user-1" },
        { table: "subscription_periods", column: "user_id", value: "user-1" },
        { table: "stripe_subscriptions", column: "user_id", value: "user-1" },
      ]),
    );
  });

  it("does not open the portal after the paid period has ended", async () => {
    periods([
      {
        id: "period-old",
        plan_key: "pvnavigator_abo",
        period_start: "2020-01-01T00:00:00.000Z",
        period_end: "2020-02-01T00:00:00.000Z",
        address_limit: 50,
      },
    ]);
    subscriptions([
      {
        status: "canceled",
        cancel_at_period_end: false,
        cancel_at: "2020-02-01T00:00:00.000Z",
        current_period_end: "2020-02-01T00:00:00.000Z",
        scheduled_plan_key: null,
        scheduled_effective_at: null,
      },
    ]);
    const response = await POST(new Request("http://127.0.0.1:3000/api/billing/portal", { method: "POST" }) as never);
    expect(response.headers.get("location")).toContain("hinweis=portal-fehlt");
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("opens the portal for an active paid period and for a payment that granted none", async () => {
    periods([
      {
        id: "period-live",
        plan_key: "pvnavigator_abo",
        period_start: "2020-01-01T00:00:00.000Z",
        period_end: "2999-01-01T00:00:00.000Z",
        address_limit: 50,
      },
    ]);
    let response = await POST(new Request("http://127.0.0.1:3000/api/billing/portal", { method: "POST" }) as never);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://billing.stripe.com/p/session/test_123");
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_123", locale: "de" }),
    );

    sessionsCreate.mockClear();
    periods([]);
    subscriptions([
      {
        status: "past_due",
        cancel_at_period_end: false,
        cancel_at: null,
        current_period_end: null,
        scheduled_plan_key: null,
        scheduled_effective_at: null,
      },
    ]);
    response = await POST(new Request("http://127.0.0.1:3000/api/billing/portal", { method: "POST" }) as never);
    expect(response.headers.get("location")).toBe("https://billing.stripe.com/p/session/test_123");
    expect(sessionsCreate).toHaveBeenCalledOnce();
  });
});
