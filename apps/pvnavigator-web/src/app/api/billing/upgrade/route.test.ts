import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const user = vi.hoisted(() => ({ current: null as { id: string; email: string } | null }));

vi.mock("@/lib/auth", () => ({
  getServerUser: vi.fn(async () => user.current),
}));

vi.mock("@/lib/billing/stripeServer", () => ({
  getStripe: vi.fn(() => null),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: vi.fn(() => null),
}));

import { POST } from "./route";

const ACCOUNT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function upgradeRequest(plan: string) {
  const body = new FormData();
  body.set("plan", plan);
  return new NextRequest("http://127.0.0.1:3000/api/billing/upgrade", {
    method: "POST",
    body,
    headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000" },
  });
}

describe("POST /api/billing/upgrade", () => {
  beforeEach(() => {
    user.current = null;
  });

  it("sends a signed-out upgrade to the login page", async () => {
    const response = await POST(upgradeRequest("pro"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/anmelden");
    expect(location.searchParams.get("next")).toBe("/tarife?auswahl=pro");
  });

  it("offers ABO and PRO upgrades to every signed-in account", async () => {
    for (const account of [ACCOUNT_A, ACCOUNT_B]) {
      for (const plan of ["abo", "pro"]) {
        user.current = { id: account, email: `${account}@example.com` };
        const response = await POST(upgradeRequest(plan));
        const location = new URL(response.headers.get("location") ?? "");
        expect(location.pathname).toBe("/tarife");
        expect(location.searchParams.get("hinweis")).toBe("nicht-konfiguriert");
        expect(location.href).not.toContain("live-gesperrt");
      }
    }
  });
});
