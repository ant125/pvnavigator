import { describe, expect, it } from "vitest";
import { createUserLoadProfile15MinForYear } from "../../../../packages/bdew-profile";
import { STEPS_PER_NON_LEAP_YEAR_15 } from "../../../../packages/pv-core";
import { createHeatPumpComponent15Min } from "./heatpump";
import { mergeHouseholdLoadComponents, mergeHouseholdWithHeatPump } from "./merge";
import { resolveEvLoadComponentForYear } from "./resolveEvLoadComponent";
import { commuterEvInput, sum } from "@/test/evFixtures";

const REL_TOL = 1e-12;
const YEAR = 2018;
const HOUSE_ANNUAL = 4500;
const HP_ANNUAL = 2000;

describe("mergeHouseholdLoadComponents", () => {
  it("household only", () => {
    const house = createUserLoadProfile15MinForYear(HOUSE_ANNUAL, YEAR);
    const merged = mergeHouseholdLoadComponents({
      householdProfile: house,
      householdAnnualKwh: HOUSE_ANNUAL,
    });
    expect(merged).toEqual(house);
    expect(Math.abs(sum(merged) - HOUSE_ANNUAL)).toBeLessThanOrEqual(
      HOUSE_ANNUAL * REL_TOL
    );
  });

  it("household + heat pump is the index-wise sum", () => {
    const house = createUserLoadProfile15MinForYear(HOUSE_ANNUAL, YEAR);
    const hp = createHeatPumpComponent15Min(HP_ANNUAL);
    const merged = mergeHouseholdLoadComponents({
      householdProfile: house,
      householdAnnualKwh: HOUSE_ANNUAL,
      extras: [hp],
    });
    expect(merged).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    for (let i = 0; i < merged.length; i++) {
      expect(merged[i]).toBeCloseTo(house[i] + hp.profile[i], 12);
    }
    expect(merged).toEqual(
      mergeHouseholdWithHeatPump({
        householdProfile: house,
        householdAnnualKwh: HOUSE_ANNUAL,
        heatPump: hp,
      })
    );
  });

  it("household + EV is the index-wise sum", () => {
    const house = createUserLoadProfile15MinForYear(HOUSE_ANNUAL, YEAR);
    const ev = resolveEvLoadComponentForYear({
      evInput: commuterEvInput(),
      year: YEAR,
    }).component;
    const merged = mergeHouseholdLoadComponents({
      householdProfile: house,
      householdAnnualKwh: HOUSE_ANNUAL,
      extras: [ev],
    });
    for (let i = 0; i < merged.length; i++) {
      expect(merged[i]).toBeCloseTo(house[i] + ev.profile[i], 12);
    }
    expect(Math.abs(sum(merged) - (HOUSE_ANNUAL + ev.yearlyConsumption))).toBeLessThanOrEqual(
      (HOUSE_ANNUAL + ev.yearlyConsumption) * 1e-9 + 1e-6
    );
  });

  it("household + HP + EV is the index-wise sum", () => {
    const house = createUserLoadProfile15MinForYear(HOUSE_ANNUAL, YEAR);
    const hp = createHeatPumpComponent15Min(HP_ANNUAL);
    const ev = resolveEvLoadComponentForYear({
      evInput: commuterEvInput(),
      year: YEAR,
    }).component;
    const merged = mergeHouseholdLoadComponents({
      householdProfile: house,
      householdAnnualKwh: HOUSE_ANNUAL,
      extras: [hp, ev],
    });
    expect(merged).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    for (let i = 0; i < merged.length; i++) {
      expect(merged[i]).toBeCloseTo(house[i] + hp.profile[i] + ev.profile[i], 12);
    }
    const expected = HOUSE_ANNUAL + HP_ANNUAL + ev.yearlyConsumption;
    expect(Math.abs(sum(merged) - expected)).toBeLessThanOrEqual(
      expected * 1e-9 + 1e-6
    );
  });
});
