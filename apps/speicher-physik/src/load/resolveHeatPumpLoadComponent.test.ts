import { describe, expect, it } from "vitest";
import { createUserLoadProfile15MinForYear } from "../../../../packages/bdew-profile";
import { STEPS_PER_NON_LEAP_YEAR_15 } from "../../../../packages/pv-core";
import { getMethodologySourceById } from "@pv-methodology/registry";
import { createHeatPumpComponent15Min } from "./heatpump";
import { mergeHouseholdWithHeatPump } from "./merge";
import {
  buildHeatPumpLoadComponent,
  buildSyntheticHeatPumpFallbackComponent,
  DEFAULT_HEAT_PUMP_DHW_SERVICE,
  DEFAULT_HEAT_PUMP_TECHNOLOGY,
} from "./resolveHeatPumpLoadComponent";

const YEAR = 2018;
const REL_TOL = 1e-9;

function sum(profile: readonly number[]): number {
  return profile.reduce((a, b) => a + b, 0);
}

describe("buildHeatPumpLoadComponent (ThermBuild production)", () => {
  it("A: Luft/Wasser + heating only selects ThermBuild O5", () => {
    const result = buildHeatPumpLoadComponent({
      technology: "luftwasser",
      dhwService: "space_heat_only",
      annualElectricalKwh: 4000,
      year: YEAR,
    });
    expect(result.meta.profileId).toBe("lw-heating-only-thermbuild-o5-v1");
    expect(result.meta.resolvedTechnology).toBe("luftwasser");
    expect(result.meta.dhwService).toBe("space_heat_only");
    expect(result.meta.quality).toBe("lab-prototype");
    expect(result.meta.methodologySourceId).toBe("thermbuild-fordatis-486");
    expect(result.meta.fallback).toBe(false);
    expect(result.meta.usedSyntheticFallback).toBe(false);
    expect(result.meta.measuredSourceClass).toBe("thermbuild-lab-prototype");
    expect(result.meta.usedLegacyDefaults).toBe(false);
  });

  it("B: Luft/Wasser + heating + DHW selects ThermBuild N2", () => {
    const result = buildHeatPumpLoadComponent({
      technology: "luftwasser",
      dhwService: "space_heat_and_dhw",
      annualElectricalKwh: 4000,
      year: YEAR,
    });
    expect(result.meta.profileId).toBe("lw-heating-dhw-thermbuild-n2-v1");
    expect(result.meta.dhwService).toBe("space_heat_and_dhw");
    expect(result.meta.fallback).toBe(false);
    expect(result.meta.usedSyntheticFallback).toBe(false);
  });

  it("Wasser/Wasser + heating + DHW selects the WPuQ production profile", () => {
    const annual = 5000;
    const result = buildHeatPumpLoadComponent({
      technology: "wasserwasser",
      dhwService: "space_heat_and_dhw",
      annualElectricalKwh: annual,
      year: YEAR,
    });
    expect(result.meta.profileId).toBe("ww-heating-dhw-wpuq-2019-sfh38-v1");
    expect(result.meta.requestedTechnology).toBe("wasserwasser");
    expect(result.meta.resolvedTechnology).toBe("wasserwasser");
    expect(result.meta.dhwService).toBe("space_heat_and_dhw");
    expect(result.meta.quality).toBe("field-cohort-representative");
    expect(result.meta.methodologySourceId).toBe("wpuq-wasserwasser-heatpump");
    expect(result.meta.license).toBe("CC-BY-4.0");
    expect(result.meta.fallback).toBe(false);
    expect(result.meta.usedSyntheticFallback).toBe(false);
    expect(result.meta.measuredSourceClass).toBe(
      "wpuq-field-cohort-representative"
    );
    expect(result.component.profile).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    expect(Math.abs(sum(result.component.profile) - annual)).toBeLessThanOrEqual(
      annual * REL_TOL
    );
  });

  it("C: unknown + heating + DHW resolves to Luft/Wasser with explicit fallback", () => {
    const result = buildHeatPumpLoadComponent({
      technology: "unknown",
      dhwService: "space_heat_and_dhw",
      annualElectricalKwh: 4000,
      year: YEAR,
    });
    expect(result.meta.requestedTechnology).toBe("unknown");
    expect(result.meta.resolvedTechnology).toBe("luftwasser");
    expect(result.meta.profileId).toBe("lw-heating-dhw-thermbuild-n2-v1");
    expect(result.meta.fallback).toBe("unknown-uses-luftwasser");
    expect(result.meta.usedSyntheticFallback).toBe(false);
    expect(result.meta.measuredSourceClass).toBe("thermbuild-lab-prototype");
  });

  it("D: legacy input (technology and dhw omitted) uses unknown + heating+DHW", () => {
    const result = buildHeatPumpLoadComponent({
      annualElectricalKwh: 3500,
      year: YEAR,
    });
    expect(DEFAULT_HEAT_PUMP_TECHNOLOGY).toBe("unknown");
    expect(DEFAULT_HEAT_PUMP_DHW_SERVICE).toBe("space_heat_and_dhw");
    expect(result.meta.usedLegacyDefaults).toBe(true);
    expect(result.meta.requestedTechnology).toBe("unknown");
    expect(result.meta.dhwService).toBe("space_heat_and_dhw");
    expect(result.meta.profileId).toBe("lw-heating-dhw-thermbuild-n2-v1");
    expect(result.meta.fallback).toBe("unknown-uses-luftwasser");
  });

  it("E: 5000 kWh heat pump component sums to 5000 kWh", () => {
    const annual = 5000;
    const result = buildHeatPumpLoadComponent({
      technology: "luftwasser",
      dhwService: "space_heat_and_dhw",
      annualElectricalKwh: annual,
      year: YEAR,
    });
    expect(result.component.profile).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    expect(result.component.profile.every((v) => Number.isFinite(v) && v >= 0)).toBe(
      true
    );
    expect(Math.abs(sum(result.component.profile) - annual)).toBeLessThanOrEqual(
      annual * REL_TOL
    );
    expect(result.component.yearlyConsumption).toBe(annual);
  });

  it("F: merged load conserves household + HP annual kWh", () => {
    const houseAnnual = 4500;
    const hpAnnual = 2000;
    const house = createUserLoadProfile15MinForYear(houseAnnual, YEAR);
    const hp = buildHeatPumpLoadComponent({
      technology: "luftwasser",
      dhwService: "space_heat_only",
      annualElectricalKwh: hpAnnual,
      year: YEAR,
    });
    const merged = mergeHouseholdWithHeatPump({
      householdProfile: house,
      householdAnnualKwh: houseAnnual,
      heatPump: hp.component,
    });
    expect(merged).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    const expected = houseAnnual + hpAnnual;
    expect(Math.abs(sum(merged) - expected)).toBeLessThanOrEqual(
      expected * REL_TOL
    );
    for (let i = 0; i < merged.length; i++) {
      expect(merged[i]).toBeCloseTo(house[i] + hp.component.profile[i], 12);
    }
  });

  it("H: no heat-pump component means household-only merge", () => {
    const houseAnnual = 4000;
    const house = createUserLoadProfile15MinForYear(houseAnnual, YEAR);
    const merged = mergeHouseholdWithHeatPump({
      householdProfile: house,
      householdAnnualKwh: houseAnnual,
      heatPump: null,
    });
    expect(merged).toEqual(house);
    expect(Math.abs(sum(merged) - houseAnnual)).toBeLessThanOrEqual(
      houseAnnual * REL_TOL
    );
  });

  it("does not silently use the synthetic seasonal model for Luft/Wasser", () => {
    const annual = 4000;
    const measured = buildHeatPumpLoadComponent({
      technology: "luftwasser",
      dhwService: "space_heat_and_dhw",
      annualElectricalKwh: annual,
      year: YEAR,
    });
    const synthetic = createHeatPumpComponent15Min(annual);
    expect(measured.component.profile).not.toEqual(synthetic.profile);
    expect(measured.meta.usedSyntheticFallback).toBe(false);
  });

  it("explicit synthetic fallback records usedSyntheticFallback", () => {
    const result = buildSyntheticHeatPumpFallbackComponent({
      annualElectricalKwh: 1800,
      year: YEAR,
      technology: "luftwasser",
      dhwService: "space_heat_and_dhw",
      usedLegacyDefaults: false,
    });
    expect(result.meta.usedSyntheticFallback).toBe(true);
    expect(result.meta.fallback).toBe("synthetic-seasonal");
    expect(result.meta.profileId).toBeNull();
    expect(result.meta.measuredSourceClass).toBe("synthetic-seasonal");
    expect(Math.abs(sum(result.component.profile) - 1800)).toBeLessThanOrEqual(
      1800 * REL_TOL
    );
  });

  it("registers WPuQ Wasser/Wasser separately from ThermBuild", () => {
    const thermbuild = getMethodologySourceById("thermbuild-fordatis-486");
    const wpuqHp = getMethodologySourceById("wpuq-wasserwasser-heatpump");
    expect(thermbuild).toBeDefined();
    expect(wpuqHp?.category).toBe("load_profiles");
    expect(wpuqHp?.url).toBe("https://www.nature.com/articles/s41597-022-01156-1");
    expect(wpuqHp?.official).toBe(true);
  });

  it("rejects non-positive annual electrical kWh", () => {
    expect(() =>
      buildHeatPumpLoadComponent({
        annualElectricalKwh: 0,
        year: YEAR,
      })
    ).toThrow(/annualElectricalKwh/);
  });

  it("rejects Wasser/Wasser heating-only (no catalogue default)", () => {
    expect(() =>
      buildHeatPumpLoadComponent({
        annualElectricalKwh: 4000,
        year: YEAR,
        technology: "wasserwasser",
        dhwService: "space_heat_only",
      })
    ).toThrow(/No heat-pump catalogue default/);
  });

  it("rejects an unsupported dhwService", () => {
    expect(() =>
      buildHeatPumpLoadComponent({
        annualElectricalKwh: 4000,
        year: YEAR,
        dhwService: "household_dhw" as never,
      })
    ).toThrow(/Unsupported heat-pump dhwService/);
  });
});

describe("heat-pump profile generation performance", () => {
  it("measured JSON path is comparable to the synthetic seasonal model", () => {
    const annual = 5000;
    const t0 = performance.now();
    createHeatPumpComponent15Min(annual);
    const msSynthetic = performance.now() - t0;

    const t1 = performance.now();
    buildHeatPumpLoadComponent({
      technology: "luftwasser",
      dhwService: "space_heat_and_dhw",
      annualElectricalKwh: annual,
      year: YEAR,
    });
    const msMeasured = performance.now() - t1;

    const t2 = performance.now();
    buildHeatPumpLoadComponent({
      technology: "luftwasser",
      dhwService: "space_heat_only",
      annualElectricalKwh: annual,
      year: YEAR,
    });
    const msSecond = performance.now() - t2;

    // eslint-disable-next-line no-console
    console.log(
      `HP profile timing: synthetic ${msSynthetic.toFixed(2)} ms; measured first ${msMeasured.toFixed(2)} ms; measured reuse-parse ${msSecond.toFixed(2)} ms`
    );

    expect(msMeasured).toBeLessThan(2000);
    expect(msSecond).toBeLessThan(500);
  });
});
