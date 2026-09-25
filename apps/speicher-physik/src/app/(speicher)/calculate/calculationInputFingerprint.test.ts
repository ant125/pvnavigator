import { describe, expect, it } from "vitest";
import type { SpeicherInput } from "../types/speicher";
import { DEFAULT_SURFACE, INITIAL_FORM_DATA } from "./calculateFormModel";
import {
  calculationInputFingerprint,
  calculationInputsAreStale,
} from "./calculationInputFingerprint";

function baseForm(overrides: Partial<SpeicherInput> = {}): Partial<SpeicherInput> {
  return {
    ...INITIAL_FORM_DATA,
    pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
    street: "Beispielstraße",
    houseNumber: "12",
    postalCode: "86154",
    city: "Augsburg",
    annualConsumptionKwh: 4500,
    ...overrides,
  };
}

describe("calculationInputFingerprint", () => {
  it("treats equivalent parsed numbers as the same input", () => {
    const a = baseForm({
      pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
    });
    const b = baseForm({
      pvSurfaces: [{ systemSizeKwP: 10.0, tiltDeg: 30, azimuthDeg: 180 }],
    });
    expect(calculationInputFingerprint(a)).toBe(calculationInputFingerprint(b));
  });

  it("trims address fields", () => {
    const a = baseForm({ city: "Augsburg" });
    const b = baseForm({ city: "  Augsburg  " });
    expect(calculationInputFingerprint(a)).toBe(calculationInputFingerprint(b));
  });

  it("ignores heat-pump details when the heat pump is disabled", () => {
    const a = baseForm({
      heatPumpEnabled: false,
      heatPumpConsumptionKwh: 5000,
      heatPumpTechnology: "luftwasser",
    });
    const b = baseForm({ heatPumpEnabled: false });
    expect(calculationInputFingerprint(a)).toBe(calculationInputFingerprint(b));
  });

  it("detects a backup-reserve change as stale", () => {
    const calculated = calculationInputFingerprint(baseForm());
    expect(
      calculationInputsAreStale(baseForm({ backupReserveKwh: 2 }), calculated)
    ).toBe(true);
    expect(calculationInputsAreStale(baseForm({ backupReserveKwh: 0 }), calculated)).toBe(
      false
    );
  });

  it("clears stale when inputs are restored", () => {
    const original = baseForm({
      heatPumpEnabled: true,
      heatPumpTechnology: "luftwasser",
      heatPumpDhwService: "space_heat_and_dhw",
      heatPumpConsumptionKwh: 5000,
    });
    const fingerprint = calculationInputFingerprint(original);
    const edited = { ...original, annualConsumptionKwh: 5000 };
    expect(calculationInputsAreStale(edited, fingerprint)).toBe(true);
    expect(calculationInputsAreStale(original, fingerprint)).toBe(false);
  });

  it("does not mark stale before a calculation exists", () => {
    expect(calculationInputsAreStale(baseForm(), null)).toBe(false);
  });

  it("includes extra roof surfaces", () => {
    const one = calculationInputFingerprint(baseForm());
    const two = calculationInputFingerprint(
      baseForm({
        pvSurfaces: [
          { systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 },
          { ...DEFAULT_SURFACE, systemSizeKwP: 4, tiltDeg: 15, azimuthDeg: 90 },
        ],
      })
    );
    expect(one).not.toBe(two);
  });
});
