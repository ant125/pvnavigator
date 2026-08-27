import { describe, expect, it } from "vitest";
import { createUserLoadProfileForYear } from "../../../../packages/bdew-profile";
import { createHeatPumpComponent } from "./heatpump";
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
