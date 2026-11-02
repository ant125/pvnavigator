import { describe, expect, it, vi } from "vitest";

import type { HouseholdCalculationInput } from "@/app/(speicher)/calculate/runHouseholdCalculation";

import {
  ACCESS_UNAVAILABLE_MESSAGE,
  calculationAddress,
  checkCalculationAccess,
  loadPinnedFreeAddress,
  recordCompletedCalculation,
  type AccessRpcClient,
} from "./calculationAccess";

const input: HouseholdCalculationInput = {
  annualConsumptionKWh: 4000,
  pvSystemKwP: 10,
  street: " Musterstr. ",
  houseNumber: "12 a",
  postalCode: "80331",
  city: "MÜNCHEN",
  tiltDeg: 35,
  azimuthDeg: 180,
};

function rpcClient(
  handlers: Record<string, (args: Record<string, unknown>) => { data?: unknown; error?: { message: string } }>,
): AccessRpcClient & { calls: { fn: string; args: Record<string, unknown> }[] } {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    rpc: (fn, args) => {
      calls.push({ fn, args });
      const handler = handlers[fn];
      if (!handler) return Promise.resolve({ data: null, error: { message: `no handler ${fn}` } });
      const result = handler(args);
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
  };
}

describe("calculationAddress", () => {
  it("derives a normalised key and a readable label from the entered fields", () => {
    const address = calculationAddress(input);
    expect(address.key).toBe("v1|de|80331|muenchen|musterstrasse|12a");
    expect(address.label).toBe("Musterstr. 12 a, 80331 MÜNCHEN");
  });
});

describe("checkCalculationAccess", () => {
  it("refuses an incomplete address without calling the database", async () => {
    const client = rpcClient({});
    const outcome = await checkCalculationAccess(client, {
      ...calculationAddress({ ...input, houseNumber: "" }),
    });
    expect(outcome.status).toBe("denied");
    expect(client.calls).toHaveLength(0);
  });

  it("passes the key to the RPC and reads the decision", async () => {
    const client = rpcClient({
      check_calculation_access: () => ({
        data: {
          allowed: true,
          tier: "paid",
          reason: "subscription_new_address",
          subscription: {
            period_id: "p",
            period_end: "2026-11-11T00:00:00+00:00",
            address_limit: 50,
            used_addresses: 4,
          },
          free_address_label: null,
        },
      }),
    });
    const outcome = await checkCalculationAccess(client, calculationAddress(input));
    expect(client.calls[0]).toEqual({
      fn: "check_calculation_access",
      args: { p_address_key: "v1|de|80331|muenchen|musterstrasse|12a" },
    });
    expect(outcome.status).toBe("allowed");
    if (outcome.status === "allowed") expect(outcome.tier).toBe("paid");
  });

  it("turns a refusal into the German explanation with the pinned address", async () => {
    const client = rpcClient({
      check_calculation_access: () => ({
        data: {
          allowed: false,
          tier: null,
          reason: "free_address_mismatch",
          subscription: null,
          free_address_label: "Alte Straße 1, 10115 Berlin",
        },
      }),
    });
    const outcome = await checkCalculationAccess(client, calculationAddress(input));
    expect(outcome.status).toBe("denied");
    if (outcome.status === "denied") {
      expect(outcome.message).toContain("Alte Straße 1, 10115 Berlin");
      expect(outcome.message).toContain("eine Adresse pro Konto");
    }
  });

  it("does not allow a calculation when the check itself fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = rpcClient({
      check_calculation_access: () => ({ error: { message: "connection refused" } }),
    });
    expect((await checkCalculationAccess(failing, calculationAddress(input))).status).toBe(
      "unavailable",
    );
    const garbage = rpcClient({ check_calculation_access: () => ({ data: { nope: true } }) });
    const outcome = await checkCalculationAccess(garbage, calculationAddress(input));
    expect(outcome.status).toBe("unavailable");
    if (outcome.status === "unavailable") expect(outcome.message).toBe(ACCESS_UNAVAILABLE_MESSAGE);
    vi.restoreAllMocks();
  });
});

describe("recordCompletedCalculation", () => {
  const address = calculationAddress(input);
  const row = { product_key: "speicher_grenze", name: "x" };

  it("returns the id and the tier decided by the database", async () => {
    const client = rpcClient({
      record_completed_calculation: () => ({
        data: { calculation_id: "22222222-2222-4222-8222-222222222222", access_tier: "free" },
      }),
    });
    const outcome = await recordCompletedCalculation(client, { address, row });
    expect(outcome).toEqual({
      status: "recorded",
      calculationId: "22222222-2222-4222-8222-222222222222",
      tier: "free",
    });
    expect(client.calls[0].args).toEqual({
      p_address_key: address.key,
      p_address_label: address.label,
      p_calculation: row,
    });
  });

  it("maps a lock-time refusal to a denied outcome with the explanation", async () => {
    const client = rpcClient({
      record_completed_calculation: () => ({
        error: { message: "PVN_ACCESS_DENIED:free_address_mismatch" },
      }),
      check_calculation_access: () => ({
        data: {
          allowed: false,
          tier: null,
          reason: "free_address_mismatch",
          subscription: null,
          free_address_label: "Erste Straße 2, 80331 München",
        },
      }),
    });
    const outcome = await recordCompletedCalculation(client, { address, row });
    expect(outcome.status).toBe("denied");
    if (outcome.status === "denied") {
      expect(outcome.reason).toBe("free_address_mismatch");
      expect(outcome.message).toContain("Erste Straße 2, 80331 München");
    }
  });

  it("loads the pinned address fields from the account's own rows", async () => {
    const client = {
      from(table: string) {
        return {
          select() {
            return {
              maybeSingle: async () =>
                table === "free_addresses"
                  ? {
                      data: {
                        address_label: "Hauptstraße 1, 80331 München",
                        calculation_id: "calc-1",
                      },
                      error: null,
                    }
                  : { data: null, error: null },
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      input: {
                        street: "Hauptstraße",
                        houseNumber: "1",
                        postalCode: "80331",
                        city: "München",
                      },
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    };
    await expect(loadPinnedFreeAddress(client)).resolves.toEqual({
      label: "Hauptstraße 1, 80331 München",
      street: "Hauptstraße",
      houseNumber: "1",
      postalCode: "80331",
      city: "München",
    });
  });

  it("keeps a technical failure distinct from a refusal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = rpcClient({
      record_completed_calculation: () => ({ error: { message: "deadlock detected" } }),
    });
    expect((await recordCompletedCalculation(client, { address, row })).status).toBe("failed");
    vi.restoreAllMocks();
  });
});
