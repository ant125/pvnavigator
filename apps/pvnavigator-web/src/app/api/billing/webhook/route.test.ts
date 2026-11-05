import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apply, finishReplacements, finishRenewals, admin } = vi.hoisted(() => ({
  apply: vi.fn(),
  finishReplacements: vi.fn(),
  finishRenewals: vi.fn(),
  admin: vi.fn<() => object | null>(() => ({})),
}));

vi.mock("@/lib/billing/applyBillingEvent", () => ({
  applyBillingEvent: (...args: unknown[]) => apply(...args),
  resolveBillingUser: vi.fn(),
}));

vi.mock("@/lib/billing/finishUpgradeReplacements", () => ({
  finishUpgradeReplacements: (...args: unknown[]) => finishReplacements(...args),
}));

vi.mock("@/lib/billing/finishFailedRenewals", () => ({
  finishFailedRenewals: (...args: unknown[]) => finishRenewals(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => admin(),
}));

vi.mock("@/lib/billing/liveBillingReport", () => ({
  reportLiveBillingConfig: vi.fn(async () => null),
}));

vi.mock("@/lib/billing/stripeKeyProbe", () => ({
  probeProductionStripe: vi.fn(async () => ({
    direct: { kind: "sk_test_", quoted: false },
    runtime: { kind: "sk_test_", quoted: false },
    reads: null,
  })),
}));

import { POST } from "./route";

const NAMES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER_ID",
  "STRIPE_PRICE_ID",
  "STRIPE_PRICE_PRO_ID",
] as const;

const previous = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
const webhookSecret = "whsec_unit_test_secret";
const signer = new Stripe("sk_test_unit_signer");

function setEnv(values: Partial<Record<(typeof NAMES)[number], string | undefined>>) {
  for (const name of NAMES) {
    if (!(name in values)) continue;
    const value = values[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function eventBody(livemode: boolean, type = "charge.succeeded"): string {
  return JSON.stringify({
    id: "evt_unit",
    object: "event",
    api_version: "2026-10-28.endive",
    type,
    livemode,
    created: 1_700_000_000,
    data: { object: { id: "ch_unit", object: "charge" } },
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
  });
}

function request(payload: string, signature: string): Request {
  return new Request("http://127.0.0.1/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  });
}

function signature(payload: string, secret = webhookSecret): string {
  return signer.webhooks.generateTestHeaderString({ payload, secret });
}

beforeEach(() => {
  apply.mockReset();
  finishReplacements.mockReset();
  finishRenewals.mockReset();
  admin.mockReset();
  admin.mockReturnValue({});
  apply.mockResolvedValue({ ok: true, outcome: "ignored" });
  finishReplacements.mockResolvedValue({ ok: true, unresolved: 0 });
  finishRenewals.mockResolvedValue({ ok: true });
  setEnv({
    STRIPE_SECRET_KEY: "sk_test_unit",
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    STRIPE_PRICE_STARTER_ID: "price_starter",
    STRIPE_PRICE_ID: "price_abo",
    STRIPE_PRICE_PRO_ID: "price_pro",
  });
});

afterEach(() => {
  for (const name of NAMES) {
    const value = previous[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("POST /api/billing/webhook", () => {
  it("rejects an invalid signature before any billing command", async () => {
    const payload = eventBody(false);
    const response = await POST(request(payload, signature(payload, "whsec_other_secret")));
    expect(response.status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
    expect(finishReplacements).not.toHaveBeenCalled();
  });

  it("ignores an unexpected event without granting access", async () => {
    const payload = eventBody(false);
    const response = await POST(request(payload, signature(payload)));
    expect(response.status).toBe(200);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]?.[1]).toMatchObject({
      eventId: "evt_unit",
      livemode: false,
      command: { action: "ignore", reason: "unhandled" },
    });
  });

  it("does not store an event from the other Stripe mode", async () => {
    const liveOnTest = eventBody(true);
    const testResponse = await POST(request(liveOnTest, signature(liveOnTest)));
    expect(testResponse.status).toBe(200);
    expect(apply).not.toHaveBeenCalled();

    setEnv({ STRIPE_SECRET_KEY: "sk_live_unit" });
    const testOnLive = eventBody(false);
    const liveResponse = await POST(request(testOnLive, signature(testOnLive)));
    expect(liveResponse.status).toBe(200);
    expect(apply).not.toHaveBeenCalled();
  });

  it("accepts a live event only when the server key is live", async () => {
    setEnv({ STRIPE_SECRET_KEY: "sk_live_unit" });
    const payload = eventBody(true);
    const response = await POST(request(payload, signature(payload)));
    expect(response.status).toBe(200);
    expect(apply.mock.calls[0]?.[1]).toMatchObject({ livemode: true, eventType: "charge.succeeded" });
  });

  it("stays closed when the key, webhook secret, database or price catalog is missing", async () => {
    setEnv({ STRIPE_SECRET_KEY: undefined });
    expect((await POST(request("{}", "invalid"))).status).toBe(500);

    setEnv({ STRIPE_SECRET_KEY: "sk_live_unit", STRIPE_WEBHOOK_SECRET: "not-a-webhook-secret" });
    expect((await POST(request("{}", "invalid"))).status).toBe(500);

    setEnv({ STRIPE_WEBHOOK_SECRET: webhookSecret });
    admin.mockReturnValue(null);
    expect((await POST(request("{}", "invalid"))).status).toBe(500);

    admin.mockReturnValue({});
    setEnv({ STRIPE_PRICE_STARTER_ID: undefined, STRIPE_PRICE_ID: undefined, STRIPE_PRICE_PRO_ID: undefined });
    expect((await POST(request("{}", "invalid"))).status).toBe(500);
    expect(apply).not.toHaveBeenCalled();
  });
});
