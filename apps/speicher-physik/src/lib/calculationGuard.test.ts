import { describe, expect, it } from "vitest";

import { parseCalculationSlot } from "./calculationGuard";

describe("parseCalculationSlot", () => {
  it("reads an acquired slot", () => {
    expect(parseCalculationSlot({ ok: true, id: "slot-1" })).toEqual({
      status: "acquired",
      id: "slot-1",
    });
  });

  it("reads a retry delay without treating it as an address quota", () => {
    expect(parseCalculationSlot({ ok: false, reason: "concurrent", retry_after_seconds: 12.2 })).toEqual({
      status: "limited",
      retryAfterSeconds: 13,
    });
    expect(parseCalculationSlot({ ok: false, reason: "rate" }).status).toBe("limited");
  });

  it("rejects a missing or malformed reply", () => {
    expect(parseCalculationSlot(null).status).toBe("unavailable");
    expect(parseCalculationSlot({ ok: true }).status).toBe("unavailable");
    expect(parseCalculationSlot({ ok: false, reason: "unauthenticated" }).status).toBe("unauthenticated");
  });
});
