import { describe, expect, it } from "vitest";
import { preflightEvProfile } from "../src/index";
import {
  commuterInput,
  evWindowUnavailable,
} from "./helpers";

describe("preflightEvProfile", () => {
  it("returns notables for valid workplace-heavy / zero-home cases", () => {
    const result = preflightEvProfile(
      commuterInput({
        annualKm: 1000,
        typicalDailyKm: { WD: 4, SA: 2, SU: 1 },
        workplace: { enabled: true, kwhPerMonth: 80, chargingDaysPerMonth: 8 },
        homeWindow: {
          WD: evWindowUnavailable(),
          SA: evWindowUnavailable(),
          SU: evWindowUnavailable(),
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const codes = result.notables.map((issue) => issue.code);
    expect(codes).toContain("WORKPLACE_EXCEEDS_DRIVING");
    expect(codes).toContain("ZERO_HOME_CHARGING");
    expect(codes).not.toContain("DRIVING_UNSERVED");
  });

  it("does not fail a large mileage normalization factor", () => {
    const result = preflightEvProfile(
      commuterInput({
        annualKm: 30000,
        typicalDailyKm: { WD: 10, SA: 5, SU: 5 },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notables.map((issue) => issue.code)).toContain(
      "MILEAGE_NORMALIZED"
    );
  });

  it("classifies invalid windows and n > W as invalid input", () => {
    const window = preflightEvProfile(
      commuterInput({
        homeWindow: {
          WD: { kind: "bounded", start: { hour: 8, minute: 0 }, end: { hour: 8, minute: 0 } },
          SA: evWindowUnavailable(),
          SU: evWindowUnavailable(),
        },
      })
    );
    expect(window).toMatchObject({
      ok: false,
      kind: "invalid_input",
    });

    const days = preflightEvProfile(
      commuterInput({
        workplace: { enabled: true, kwhPerMonth: 10, chargingDaysPerMonth: 23 },
      })
    );
    expect(days).toMatchObject({
      ok: false,
      kind: "invalid_input",
    });
    if (!days.ok) {
      expect(days.issues[0].code).toBe("WORKPLACE_DAYS_EXCEED_WEEKDAYS");
    }
  });

  it("classifies unserved driving as infeasible", () => {
    const result = preflightEvProfile(
      commuterInput({
        usableBatteryCapacityKwh: 1,
        maxHomeChargePowerKw: 0,
        workplace: { enabled: false },
        homeWindow: {
          WD: evWindowUnavailable(),
          SA: evWindowUnavailable(),
          SU: evWindowUnavailable(),
        },
      })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("infeasible");
    expect(result.issues[0].code).toBe("DRIVING_UNSERVED");
  });
});
