import { describe, expect, it } from "vitest";
import { createEvProfile, EvProfileError } from "../src/index";
import { buildEvModelDays, countEvDayTypes } from "../src/calendar";
import { normalizeDrivingDistances } from "../src/normalize";
import { commuterInput, sum } from "./helpers";

describe("driving-distance normalization", () => {
  it("recovers exact annual km and identical driving kWh across years", () => {
    const years = [2006, 2008, 2011, 2018, 2020];
    const demands = years.map((year) => {
      const result = createEvProfile(commuterInput({ year }));
      const days = buildEvModelDays(year);
      const norm = normalizeDrivingDistances(
        15000,
        commuterInput().typicalDailyKm,
        days,
        countEvDayTypes(days)
      );
      expect(Math.abs(sum(norm.dailyKm) - 15000)).toBeLessThan(1e-9);
      expect(result.meta.annualDrivingDemandKwh).toBe(15000 * 0.18);
      expect(result.meta.impliedAnnualKmFromTypicalDistances).toBe(
        261 * 40 + 52 * 20 + 52 * 10
      );
      expect(result.meta.normalizationFactor).toBeCloseTo(15000 / 12000, 12);
      return result.meta.annualDrivingDemandKwh;
    });
    expect(new Set(demands).size).toBe(1);
  });

  it("supports weekend-only temporal shape", () => {
    const result = createEvProfile(
      commuterInput({
        annualKm: 5200,
        typicalDailyKm: { WD: 0, SA: 50, SU: 50 },
        workplace: { enabled: false },
      })
    );
    expect(result.meta.impliedAnnualKmFromTypicalDistances).toBe(5200);
    expect(result.meta.normalizationFactor).toBe(1);
    expect(result.meta.annualDrivingDemandKwh).toBe(5200 * 0.18);
    expect(result.meta.drivingUnservedKwh).toBeLessThan(1e-6);
  });

  it("keeps annual km = 0 authoritative even if typical distances are non-zero", () => {
    const result = createEvProfile(
      commuterInput({
        annualKm: 0,
        workplace: { enabled: false },
      })
    );
    expect(result.meta.annualDrivingDemandKwh).toBe(0);
    expect(result.meta.drivingServedKwh).toBe(0);
    expect(result.meta.normalizationFactor).toBe(0);
    expect(result.meta.impliedAnnualKmFromTypicalDistances).toBe(12000);
  });

  it("rejects all-zero temporal shape with positive annual km", () => {
    expect(() =>
      createEvProfile(
        commuterInput({
          annualKm: 1000,
          typicalDailyKm: { WD: 0, SA: 0, SU: 0 },
        })
      )
    ).toThrow(EvProfileError);
    try {
      createEvProfile(
        commuterInput({
          annualKm: 1000,
          typicalDailyKm: { WD: 0, SA: 0, SU: 0 },
        })
      );
    } catch (error) {
      expect(error).toBeInstanceOf(EvProfileError);
      expect((error as EvProfileError).code).toBe("MISSING_TEMPORAL_SHAPE");
      expect((error as EvProfileError).kind).toBe("invalid_input");
    }
  });
});
