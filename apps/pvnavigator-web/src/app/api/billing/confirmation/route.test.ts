import { describe, expect, it, vi } from "vitest";

const { retrieve, recover } = vi.hoisted(() => ({
  retrieve: vi.fn(),
  recover: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getServerUser: vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111", email: "person@example.com" })),
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
  createServiceRoleClient: vi.fn(() => ({})),
}));

import { GET } from "./route";

describe("GET /api/billing/confirmation", () => {
  it("does not read Stripe or recover a checkout while billing is paused", async () => {
    const response = await GET(new Request("http://127.0.0.1:3000/api/billing/confirmation?session_id=cs_test_abo"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ state: "closed" });
    expect(retrieve).not.toHaveBeenCalled();
    expect(recover).not.toHaveBeenCalled();
  });
});
