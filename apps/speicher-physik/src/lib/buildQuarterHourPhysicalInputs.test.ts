import { describe, expect, it } from "vitest";
import {
  BDEW_H25_STEPS_PER_NON_LEAP_YEAR,
  createUserLoadProfile15MinForYear,
  createUserLoadProfileForYear,
} from "../../../../packages/bdew-profile";
import {
  DEFAULT_TIME_STEP_HOURS,
  STEPS_PER_NON_LEAP_YEAR_15,
  TIME_STEP_HOURS_15,
  calculateBatterySimulation,
  expandHourlyEnergyToQuarterHours,
} from "../../../../packages/pv-core";
import { createHeatPumpComponent } from "@/load/heatpump";
import { mergeLoadProfiles } from "@/load/merge";
import { buildQuarterHourPhysicalInputsForYear } from "./buildQuarterHourPhysicalInputs";

const HOURS_PER_YEAR = 8760;
const REL_TOL = 1e-12;
const WEATHER_YEARS = Array.from({ length: 15 }, (_, i) => 2006 + i);

function sum(a: readonly number[]): number {
  return a.reduce((s, x) => s + x, 0);
}

function syntheticHourlyPv(year: number): number[] {
  const out = new Array<number>(HOURS_PER_YEAR);
  for (let h = 0; h < HOURS_PER_YEAR; h++) {
    const hourOfDay = h % 24;
    out[h] =
      hourOfDay >= 8 && hourOfDay < 16 ? 0.4 + ((year + h) % 5) * 0.05 : 0;
  }
  return out;
}

describe("buildQuarterHourPhysicalInputsForYear", () => {
  it("G/H: household is 35040 and sums to annual consumption (native H25)", () => {
    const annual = 4500;
    const inputs = buildQuarterHourPhysicalInputsForYear({
      year: 2018,
      annualConsumptionKWh: annual,
      hourlyPvKwh: syntheticHourlyPv(2018),
    });
    expect(inputs.householdLoadKwh).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    expect(inputs.householdLoadKwh).toHaveLength(BDEW_H25_STEPS_PER_NON_LEAP_YEAR);
    expect(Math.abs(sum(inputs.householdLoadKwh) - annual)).toBeLessThanOrEqual(
      annual * REL_TOL
    );
    expect(inputs.heatPumpLoadKwh).toBeNull();
    expect(inputs.heatPumpMeta).toBeNull();
    expect(inputs.timeStepHours).toBe(TIME_STEP_HOURS_15);
    expect(inputs.stepsPerYear).toBe(35040);
  });

  it("uses year-specific BDEW 15-min calendars for 2006–2020 (365 days, no leap day)", () => {
    const annual = 4000;
    for (const year of WEATHER_YEARS) {
      const profile = createUserLoadProfile15MinForYear(annual, year);
      expect(profile).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
      expect(Math.abs(sum(profile) - annual)).toBeLessThanOrEqual(annual * REL_TOL);
    }
    const leap = createUserLoadProfile15MinForYear(annual, 2020);
    const nonLeap = createUserLoadProfile15MinForYear(annual, 2019);
    expect(leap).toHaveLength(nonLeap.length);
    expect(JSON.stringify(leap)).not.toBe(JSON.stringify(nonLeap));
  });

  it("old vs new annual energy parity (household, WP, total load, PV yield)", () => {
    const year = 2018;
    const houseAnnual = 4500;
    const hpAnnual = 2000;
    const hourlyPv = syntheticHourlyPv(year);

    const houseHourly = createUserLoadProfileForYear(houseAnnual, year);
    const hpHourly = createHeatPumpComponent(hpAnnual).profile;
    const loadHourly = mergeLoadProfiles([
      { name: "house", yearlyConsumption: houseAnnual, profile: houseHourly },
      { name: "heatPump", yearlyConsumption: hpAnnual, profile: hpHourly },
    ]);

    const qh = buildQuarterHourPhysicalInputsForYear({
      year,
      annualConsumptionKWh: houseAnnual,
      hourlyPvKwh: hourlyPv,
      heatPumpEnabled: true,
      heatPumpConsumptionKWh: hpAnnual,
    });

    expect(qh.householdLoadKwh).toHaveLength(35040);
    expect(qh.heatPumpLoadKwh).toHaveLength(35040);
    expect(qh.mergedLoadKwh).toHaveLength(35040);
    expect(qh.pvKwh).toHaveLength(35040);
    expect(qh.heatPumpMeta?.profileId).toBe("lw-heating-dhw-thermbuild-n2-v1");
    expect(qh.heatPumpMeta?.usedLegacyDefaults).toBe(true);

    expect(Math.abs(sum(qh.householdLoadKwh) - sum(houseHourly))).toBeLessThanOrEqual(
      houseAnnual * REL_TOL
    );
    expect(Math.abs(sum(qh.heatPumpLoadKwh!) - sum(hpHourly))).toBeLessThanOrEqual(
      hpAnnual * REL_TOL
    );
    expect(Math.abs(sum(qh.mergedLoadKwh) - sum(loadHourly))).toBeLessThanOrEqual(
      (houseAnnual + hpAnnual) * REL_TOL
    );
    expect(Math.abs(sum(qh.pvKwh) - sum(hourlyPv))).toBeLessThanOrEqual(
      sum(hourlyPv) * REL_TOL + 1e-12
    );
  });

  it("A/B: explicit Luft/Wasser DHW service selects O5 vs N2", () => {
    const year = 2018;
    const hourlyPv = syntheticHourlyPv(year);
    const heatingOnly = buildQuarterHourPhysicalInputsForYear({
      year,
      annualConsumptionKWh: 4000,
      hourlyPvKwh: hourlyPv,
      heatPumpEnabled: true,
      heatPumpConsumptionKWh: 3000,
      heatPumpTechnology: "luftwasser",
      heatPumpDhwService: "space_heat_only",
    });
    const heatingAndDhw = buildQuarterHourPhysicalInputsForYear({
      year,
      annualConsumptionKWh: 4000,
      hourlyPvKwh: hourlyPv,
      heatPumpEnabled: true,
      heatPumpConsumptionKWh: 3000,
      heatPumpTechnology: "luftwasser",
      heatPumpDhwService: "space_heat_and_dhw",
    });
    expect(heatingOnly.heatPumpMeta?.profileId).toBe(
      "lw-heating-only-thermbuild-o5-v1"
    );
    expect(heatingAndDhw.heatPumpMeta?.profileId).toBe(
      "lw-heating-dhw-thermbuild-n2-v1"
    );
    expect(heatingOnly.heatPumpLoadKwh).not.toEqual(heatingAndDhw.heatPumpLoadKwh);
  });

  it("battery default remains dt=1; production passes TIME_STEP_HOURS_15", () => {
    expect(DEFAULT_TIME_STEP_HOURS).toBe(1);
    expect(TIME_STEP_HOURS_15).toBe(0.25);
  });
});

describe("Phase 4C input-layer performance (not a production switch)", () => {
  it("expand / BDEW 15-min / WP 15-min / merge are small vs one battery year", () => {
    const year = 2018;
    const houseAnnual = 4500;
    const hpAnnual = 2000;
    const hourlyPv = syntheticHourlyPv(year);

    const t0 = performance.now();
    expandHourlyEnergyToQuarterHours(hourlyPv);
    const msExpand = performance.now() - t0;

    const t1 = performance.now();
    const house = createUserLoadProfile15MinForYear(houseAnnual, year);
    const msBdew = performance.now() - t1;

    const t2 = performance.now();
    const qh = buildQuarterHourPhysicalInputsForYear({
      year,
      annualConsumptionKWh: houseAnnual,
      hourlyPvKwh: hourlyPv,
      heatPumpEnabled: true,
      heatPumpConsumptionKWh: hpAnnual,
    });
    const msBuilder = performance.now() - t2;

    const t3 = performance.now();
    mergeLoadProfiles([
      { name: "house", yearlyConsumption: houseAnnual, profile: house },
      {
        name: "heatPump",
        yearlyConsumption: hpAnnual,
        profile: qh.heatPumpLoadKwh!,
      },
    ]);
    const msMerge = performance.now() - t3;

    const loadHour = createUserLoadProfileForYear(houseAnnual, year);
    const t4 = performance.now();
    calculateBatterySimulation(loadHour, hourlyPv, 10, undefined, undefined, {
      timeStepHours: 1,
    });
    const msBatteryHour = performance.now() - t4;

    // eslint-disable-next-line no-console
    console.log(
      `4C input benchmark: PV expand ${msExpand.toFixed(2)} ms; BDEW 15-min ${msBdew.toFixed(2)} ms; builder(HP+merge+PV) ${msBuilder.toFixed(2)} ms; merge 35040 ${msMerge.toFixed(2)} ms; battery 8760×dt=1 (1 size) ${msBatteryHour.toFixed(2)} ms`
    );

    expect(msExpand).toBeLessThan(500);
    expect(msBdew).toBeLessThan(2000);
    expect(msBuilder).toBeLessThan(2000);
    expect(msMerge).toBeLessThan(200);
  });
});
