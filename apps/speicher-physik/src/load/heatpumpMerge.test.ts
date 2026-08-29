import { describe, expect, it } from "vitest";
import {
  createUserLoadProfile15MinForYear,
  createUserLoadProfileForYear,
} from "../../../../packages/bdew-profile";
import {
  STEPS_PER_HOUR_15,
  STEPS_PER_NON_LEAP_YEAR_15,
} from "../../../../packages/pv-core";
import {
  createHeatPumpComponent,
  createHeatPumpComponent15Min,
} from "./heatpump";
import { mergeLoadProfiles } from "./merge";

const HOURS_PER_YEAR = 8760;
const REL_TOL = 1e-12;

function sum(profile: number[]): number {
  return profile.reduce((a, b) => a + b, 0);
}

describe("heat pump and merged load annual normalization", () => {
  it("heat-pump profile is 8760h and sums to entered annual kWh", () => {
    const hp = createHeatPumpComponent(2400);
    expect(hp.profile).toHaveLength(HOURS_PER_YEAR);
    expect(Math.abs(sum(hp.profile) - 2400)).toBeLessThanOrEqual(
      2400 * REL_TOL
    );
    expect(hp.yearlyConsumption).toBe(2400);
  });

  it("household + heat-pump merge is 8760h and sums to both inputs", () => {
    const houseAnnual = 4500;
    const hpAnnual = 2000;
    const house = createUserLoadProfileForYear(houseAnnual, 2018);
    const hp = createHeatPumpComponent(hpAnnual);
    const merged = mergeLoadProfiles([
      {
        name: "house",
        yearlyConsumption: houseAnnual,
        profile: house,
      },
      hp,
    ]);
    expect(merged).toHaveLength(HOURS_PER_YEAR);
    const expected = houseAnnual + hpAnnual;
    expect(Math.abs(sum(merged) - expected)).toBeLessThanOrEqual(
      expected * REL_TOL
    );
  });
});

describe("15-min heat pump and length-safe merge", () => {
  it("I/J: 35040 steps and sum equals annual heat-pump kWh", () => {
    const annual = 2400;
    const hp = createHeatPumpComponent15Min(annual);
    expect(hp.profile).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    expect(Math.abs(sum(hp.profile) - annual)).toBeLessThanOrEqual(
      annual * REL_TOL
    );
  });

  it("each hour of the hourly WP equals four quarter-hours of the 15-min WP", () => {
    const annual = 1800;
    const hourly = createHeatPumpComponent(annual).profile;
    const qh = createHeatPumpComponent15Min(annual).profile;
    for (let h = 0; h < HOURS_PER_YEAR; h++) {
      const base = h * STEPS_PER_HOUR_15;
      const hourSum = qh[base] + qh[base + 1] + qh[base + 2] + qh[base + 3];
      expect(Math.abs(hourSum - hourly[h])).toBeLessThanOrEqual(
        Math.abs(hourly[h]) * REL_TOL + 1e-15
      );
    }
  });

  it("K/L: merged[i] === household[i] + hp[i] and annual sums add", () => {
    const houseAnnual = 4500;
    const hpAnnual = 2000;
    const house = createUserLoadProfile15MinForYear(houseAnnual, 2018);
    const hp = createHeatPumpComponent15Min(hpAnnual);
    const merged = mergeLoadProfiles([
      {
        name: "house",
        yearlyConsumption: houseAnnual,
        profile: house,
      },
      hp,
    ]);
    expect(merged).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    for (let i = 0; i < merged.length; i++) {
      expect(merged[i]).toBeCloseTo(house[i] + hp.profile[i], 12);
    }
    expect(Math.abs(sum(merged) - (houseAnnual + hpAnnual))).toBeLessThanOrEqual(
      (houseAnnual + hpAnnual) * REL_TOL
    );
  });

  it("M: mismatched 8760 + 35040 lengths throw", () => {
    const house = createUserLoadProfileForYear(4000, 2018);
    const hp = createHeatPumpComponent15Min(1000);
    expect(() =>
      mergeLoadProfiles([
        { name: "house", yearlyConsumption: 4000, profile: house },
        hp,
      ])
    ).toThrow(/timestep length/);
  });
});
