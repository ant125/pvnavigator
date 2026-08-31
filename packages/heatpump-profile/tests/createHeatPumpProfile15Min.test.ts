import { describe, expect, it } from "vitest";
import {
  createHeatPumpProfile15Min,
  getHeatPumpCatalogueEntry,
  loadHeatPumpProfile,
} from "../src/index";
import { HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR } from "../src/types";

const ANNUAL_SUM_REL_TOL = 1e-12;
const WEATHER_YEARS = [2006, 2012, 2018, 2020, 2024, 2025];

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

describe("createHeatPumpProfile15Min", () => {
  it("selects heating-only vs heating+DHW from the catalogue", () => {
    const heatingOnly = createHeatPumpProfile15Min({
      technology: "luftwasser",
      annualElectricalKwh: 4000,
      dhwService: "space_heat_only",
      year: 2018,
    });
    const heatingAndDhw = createHeatPumpProfile15Min({
      technology: "luftwasser",
      annualElectricalKwh: 4000,
      dhwService: "space_heat_and_dhw",
      year: 2018,
    });
    expect(heatingOnly.meta.resolvedProfile.profileId).toBe(
      "lw-heating-only-thermbuild-o5-v1"
    );
    expect(heatingAndDhw.meta.resolvedProfile.profileId).toBe(
      "lw-heating-dhw-thermbuild-n2-v1"
    );
    expect(heatingOnly.profile).not.toEqual(heatingAndDhw.profile);
  });

  it.each([
    ["lw-heating-only-thermbuild-o5-v1", "space_heat_only", 3000],
    ["lw-heating-dhw-thermbuild-n2-v1", "space_heat_and_dhw", 7500],
  ] as const)(
    "%s: length 35040 and sum equals requested kWh",
    (profileId, dhwService, annual) => {
      const { profile, meta } = createHeatPumpProfile15Min({
        technology: "luftwasser",
        annualElectricalKwh: annual,
        dhwService,
        year: 2018,
        profileId,
      });
      expect(profile).toHaveLength(HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR);
      expect(Math.abs(sum(profile) - annual)).toBeLessThanOrEqual(
        annual * ANNUAL_SUM_REL_TOL
      );
      expect(meta.steps).toBe(HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR);
      expect(meta.resolvedProfile.profileId).toBe(profileId);
    }
  );

  it("preserves the measured shape under uniform scale", () => {
    const entry = getHeatPumpCatalogueEntry(
      "lw-heating-dhw-thermbuild-n2-v1"
    );
    if (!entry) throw new Error("missing catalogue row");
    const envelope = loadHeatPumpProfile(entry);
    const e1 = 3000;
    const e2 = 7500;
    const a = createHeatPumpProfile15Min({
      technology: "luftwasser",
      annualElectricalKwh: e1,
      dhwService: "space_heat_and_dhw",
      year: 2018,
    });
    const b = createHeatPumpProfile15Min({
      technology: "luftwasser",
      annualElectricalKwh: e2,
      dhwService: "space_heat_and_dhw",
      year: 2018,
    });
    expect(a.meta.scaleFactor).toBe(e1 / sum(envelope.weights));
    expect(b.meta.scaleFactor).toBe(e2 / sum(envelope.weights));
    for (let i = 0; i < envelope.weights.length; i++) {
      expect(a.profile[i]).toBe(envelope.weights[i] * a.meta.scaleFactor);
      expect(b.profile[i]).toBe(envelope.weights[i] * b.meta.scaleFactor);
    }
  });

  it("preserves catalogue metadata on the result", () => {
    const { meta } = createHeatPumpProfile15Min({
      technology: "unknown",
      annualElectricalKwh: 4000,
      dhwService: "space_heat_only",
      year: 2018,
    });
    expect(meta.resolvedProfile.profileId).toBe(
      "lw-heating-only-thermbuild-o5-v1"
    );
    expect(meta.methodologySourceId).toBe("thermbuild-fordatis-486");
    expect(meta.license).toBe("CC-BY-SA-4.0");
    expect(meta.fallback).toBe("unknown-uses-luftwasser");
    expect(meta.calendarRemap).toBe(false);
    expect(meta.timeStepHours).toBe(0.25);
    expect(meta.measuredAnnualElectricalKwh).toBeGreaterThan(0);
    expect(meta.year).toBe(2018);
    expect(meta.leapDayOmitted).toBe(false);
  });

  it.each(WEATHER_YEARS)(
    "year %i: always 35040 steps; leap years do not remap shape",
    (year) => {
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const result = createHeatPumpProfile15Min({
        technology: "luftwasser",
        annualElectricalKwh: 4500,
        dhwService: "space_heat_only",
        year,
      });
      expect(result.profile).toHaveLength(HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR);
      expect(result.meta.leapDayOmitted).toBe(leap);
      expect(result.meta.calendarRemap).toBe(false);
    }
  );

  it("leap and non-leap calendars yield the same measured shape", () => {
    const leap = createHeatPumpProfile15Min({
      technology: "luftwasser",
      annualElectricalKwh: 4000,
      dhwService: "space_heat_and_dhw",
      year: 2024,
    });
    const nonLeap = createHeatPumpProfile15Min({
      technology: "luftwasser",
      annualElectricalKwh: 4000,
      dhwService: "space_heat_and_dhw",
      year: 2025,
    });
    expect(leap.profile).toEqual(nonLeap.profile);
    expect(leap.meta.scaleFactor).toBe(nonLeap.meta.scaleFactor);
    expect(leap.meta.leapDayOmitted).toBe(true);
    expect(nonLeap.meta.leapDayOmitted).toBe(false);
  });

  it("rejects non-positive annual electrical energy", () => {
    expect(() =>
      createHeatPumpProfile15Min({
        technology: "luftwasser",
        annualElectricalKwh: 0,
        dhwService: "space_heat_only",
        year: 2018,
      })
    ).toThrow(/positive finite/);
  });

  it("rejects a non-integer year", () => {
    expect(() =>
      createHeatPumpProfile15Min({
        technology: "luftwasser",
        annualElectricalKwh: 4000,
        dhwService: "space_heat_only",
        year: 2018.5,
      })
    ).toThrow(/year must be an integer/);
  });
});
