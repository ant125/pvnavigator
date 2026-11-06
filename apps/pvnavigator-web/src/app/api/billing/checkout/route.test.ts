import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const user = vi.hoisted(() => ({ current: null as { id: string; email: string } | null }));

vi.mock("@/lib/auth", () => ({
  getServerUser: vi.fn(async () => user.current),
}));

vi.mock("@/lib/billing/stripeServer", () => ({
  getStripe: vi.fn(() => null),
  catalogEntryForPlan: vi.fn(() => null),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: vi.fn(() => null),
}));

import { POST } from "./route";

const ACCOUNT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function checkoutRequest(plan: string, origin: string | null) {
  const body = new FormData();
  body.set("plan", plan);
  const headers = new Headers({ host: "127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000" });
  if (origin) headers.set("origin", origin);
  return new NextRequest("http://127.0.0.1:3000/api/billing/checkout", { method: "POST", body, headers });
}

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    user.current = null;
  });

  it("sends a direct call without a signed-in user to the login page", async () => {
    const response = await POST(checkoutRequest("starter", "http://127.0.0.1:3000"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(response.status).toBe(303);
    expect(location.pathname).toBe("/anmelden");
    expect(location.searchParams.get("next")).toBe("/tarife?auswahl=starter");
    expect(location.searchParams.get("hinweis")).toBeNull();
  });

  it("rejects a direct call from another origin before any checkout", async () => {
    user.current = { id: ACCOUNT_A, email: "a@example.com" };
    const response = await POST(checkoutRequest("abo", "https://example.test"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/tarife");
    expect(location.search).toBe("");
  });

  it("treats two signed-in accounts the same for every paid tariff", async () => {
    for (const account of [ACCOUNT_A, ACCOUNT_B]) {
      for (const plan of ["starter", "abo", "pro"]) {
        user.current = { id: account, email: `${account}@example.com` };
        const response = await POST(checkoutRequest(plan, "http://127.0.0.1:3000"));
        const location = new URL(response.headers.get("location") ?? "");
        expect(location.pathname).toBe("/tarife");
        expect(location.searchParams.get("hinweis")).toBe("nicht-konfiguriert");
        expect(location.href).not.toContain("live-gesperrt");
      }
    }
  });
});
