import { beforeEach, describe, expect, it, vi } from "vitest";

import { paymentStatusCopy } from "@/components/tariffs/paymentStatusCopy";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SESSION = "cs_test_abo";

const { retrieve, recover, periodReads } = vi.hoisted(() => ({
  retrieve: vi.fn(),
  recover: vi.fn(),
  periodReads: [] as Array<{ data: unknown; error: { message: string } | null }>,
}));

vi.mock("@/lib/auth", () => ({
  getServerUser: vi.fn(async () => ({ id: USER, email: "person@example.com" })),
}));

vi.mock("@/lib/billing/stripeServer", () => ({
  getStripe: vi.fn(() => ({
    checkout: { sessions: { retrieve: (...args: unknown[]) => retrieve(...args) } },
  })),
}));

vi.mock("@/lib/billing/paymentRecoveryServer", () => ({
  recoverPaidCheckoutSession: (...args: unknown[]) => recover(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: vi.fn(() => ({
    from() {
      const result = periodReads.shift() ?? { data: null, error: null };
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        maybeSingle: () => Promise.resolve(result),
      };
      return query;
    },
  })),
}));

import { GET } from "./route";

function request() {
  return new Request(`http://127.0.0.1:3000/api/billing/confirmation?session_id=${SESSION}`);
}

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION,
    payment_status: "paid",
    status: "complete",
    client_reference_id: USER,
    metadata: { user_id: USER, plan_key: "pvnavigator_starter" },
    customer: "cus_1",
    subscription: "sub_abo",
    invoice: "in_abo",
    ...overrides,
  };
}

function period(planKey: string) {
  return {
    data: { id: "period-1", period_end: "2026-11-25T09:38:14.000Z", plan_key: planKey },
    error: null,
  };
}

describe("GET /api/billing/confirmation", () => {
  beforeEach(() => {
    retrieve.mockReset();
    recover.mockReset();
    periodReads.length = 0;
  });

  it("recovers a paid session that has no local period and returns the stored tariff", async () => {
    retrieve.mockResolvedValue(paidSession());
    periodReads.push({ data: null, error: null }, period("pvnavigator_abo"));
    recover.mockResolvedValue({
      status: "granted",
      invoiceId: "in_abo",
      subscriptionId: "sub_abo",
      replacementPending: false,
    });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      state: "active",
      periodEnd: "2026-11-25T09:38:14.000Z",
      planKey: "pvnavigator_abo",
    });
    expect(recover).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledWith(USER, SESSION);
    expect(paymentStatusCopy("active", "pvnavigator_abo").title).toBe("ABO ist aktiv");
  });

  it("keeps an already stored STARTER, ABO or PRO period unchanged", async () => {
    for (const planKey of ["pvnavigator_starter", "pvnavigator_abo", "pvnavigator_pro"]) {
      retrieve.mockResolvedValue(paidSession({ invoice: `in_${planKey}` }));
      periodReads.push(period(planKey));
      const response = await GET(request());
      expect(response.status).toBe(200);
      const body = (await response.json()) as { state: string; planKey: string };
      expect(body).toMatchObject({ state: "active", planKey });
      expect(paymentStatusCopy("active", body.planKey).tariff).not.toBeNull();
    }
    expect(recover).not.toHaveBeenCalled();
    expect(paymentStatusCopy("active", "pvnavigator_starter").title).toBe("STARTER ist aktiv");
    expect(paymentStatusCopy("active", "pvnavigator_abo").title).toBe("ABO ist aktiv");
    expect(paymentStatusCopy("active", "pvnavigator_pro").title).toBe("PRO ist aktiv");
  });

  it("does not recover an unpaid or expired session", async () => {
    retrieve.mockResolvedValue(paidSession({ payment_status: "unpaid", status: "expired" }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "unpaid" });
    expect(recover).not.toHaveBeenCalled();
    expect(paymentStatusCopy("unpaid", "pvnavigator_abo").tariff).toBeNull();
  });

  it("rejects a checkout session that belongs to someone else", async () => {
    retrieve.mockResolvedValue(
      paidSession({ client_reference_id: OTHER, metadata: { user_id: OTHER } }),
    );
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ state: "forbidden" });
    expect(recover).not.toHaveBeenCalled();
  });

  it("does not announce success when Stripe or the stored period is unavailable", async () => {
    retrieve.mockRejectedValue(new Error("StripeConnectionError"));
    const down = await GET(request());
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ state: "unavailable" });
    expect(recover).not.toHaveBeenCalled();

    retrieve.mockResolvedValue(paidSession());
    periodReads.push({ data: null, error: null });
    recover.mockResolvedValue({ status: "retry", reason: "unavailable" });
    const retry = await GET(request());
    expect(retry.status).toBe(503);
    expect(await retry.json()).toEqual({ state: "unavailable" });

    periodReads.push({ data: null, error: null }, { data: null, error: null });
    recover.mockResolvedValue({
      status: "granted",
      invoiceId: "in_abo",
      subscriptionId: "sub_abo",
      replacementPending: false,
    });
    const missingRow = await GET(request());
    expect(missingRow.status).toBe(503);
    expect(await missingRow.json()).toEqual({ state: "unavailable" });
    expect(paymentStatusCopy("unavailable", "pvnavigator_abo").detail).not.toContain("erfolgreich");
    expect(paymentStatusCopy("unavailable", "pvnavigator_abo").tariff).toBeNull();
  });

  it("does not grant access from a paid checkout status the database rejects", async () => {
    retrieve.mockResolvedValue(paidSession());
    periodReads.push({ data: null, error: null });
    recover.mockResolvedValue({ status: "refused", reason: "not_granted" });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "unpaid" });
    expect(paymentStatusCopy("unpaid", null).tariff).toBeNull();
  });

  it("does not call recovery again once the paid period is stored", async () => {
    retrieve.mockResolvedValue(paidSession());
    periodReads.push({ data: null, error: null }, period("pvnavigator_abo"), period("pvnavigator_abo"));
    recover.mockResolvedValue({
      status: "granted",
      invoiceId: "in_abo",
      subscriptionId: "sub_abo",
      replacementPending: false,
    });

    const first = await GET(request());
    const second = await GET(request());
    expect((await first.json()).planKey).toBe("pvnavigator_abo");
    expect((await second.json()).planKey).toBe("pvnavigator_abo");
    expect(recover).toHaveBeenCalledTimes(1);
  });
});
