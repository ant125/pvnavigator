import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyCronSweep } from "@/lib/billing/cronCheckoutRecovery";

const { recoverBatch, finishReplacements, finishRenewals, stripe, admin } = vi.hoisted(() => ({
  recoverBatch: vi.fn(),
  finishReplacements: vi.fn(),
  finishRenewals: vi.fn(),
  stripe: vi.fn<() => object | null>(() => ({})),
  admin: vi.fn<() => object | null>(() => ({})),
}));

vi.mock("@/lib/billing/paymentRecoveryServer", () => ({
  recoverCronCheckoutBatch: (...args: unknown[]) => recoverBatch(...args),
}));

vi.mock("@/lib/billing/finishUpgradeReplacements", () => ({
  finishUpgradeReplacements: (...args: unknown[]) => finishReplacements(...args),
}));

vi.mock("@/lib/billing/finishFailedRenewals", () => ({
  finishFailedRenewals: (...args: unknown[]) => finishRenewals(...args),
}));

vi.mock("@/lib/billing/stripeServer", () => ({
  getStripe: () => stripe(),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => admin(),
}));

import { GET } from "./route";

const calls: string[] = [];

function request(authorization?: string): Request {
  return new Request("http://127.0.0.1/api/billing/finish-replacements", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/billing/finish-replacements", () => {
  const previousSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "top-secret";
    calls.length = 0;
    recoverBatch.mockReset();
    finishReplacements.mockReset();
    finishRenewals.mockReset();
    stripe.mockReset();
    admin.mockReset();
    stripe.mockReturnValue({});
    admin.mockReturnValue({});
    recoverBatch.mockImplementation(async () => {
      calls.push("recover");
      return { ...emptyCronSweep(), customers: 1, sessions: 1, recovered: 1 };
    });
    finishReplacements.mockImplementation(async () => {
      calls.push("replacements");
      return { ok: true, unresolved: 0, finished: 1 };
    });
    finishRenewals.mockImplementation(async () => {
      calls.push("renewals");
      return { ok: true };
    });
  });

  it("rejects a missing or wrong cron secret before any billing work", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("does not scan customers when Stripe or the service role is missing", async () => {
    stripe.mockReturnValue(null);
    expect((await GET(request("Bearer top-secret"))).status).toBe(503);
    admin.mockReturnValue(null);
    stripe.mockReturnValue({});
    expect((await GET(request("Bearer top-secret"))).status).toBe(503);
    expect(calls).toEqual([]);
  });

  it("recovers checkouts, then finishes replacements and failed renewals", async () => {
    const response = await GET(request("Bearer top-secret"));
    expect(response.status).toBe(200);
    expect(calls).toEqual(["recover", "replacements", "renewals"]);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      unresolved: 0,
      replacementsFinished: 1,
      recovery: { customers: 1, sessions: 1, recovered: 1 },
    });
  });

  it("keeps the other finishers when one customer still needs a retry", async () => {
    recoverBatch.mockImplementation(async () => {
      calls.push("recover");
      return { ...emptyCronSweep(), customers: 3, retry: 1, recovered: 2 };
    });
    const response = await GET(request("Bearer top-secret"));
    expect(response.status).toBe(200);
    expect(calls).toEqual(["recover", "replacements", "renewals"]);
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });
});
