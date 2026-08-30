import { describe, expect, it } from "vitest";
import {
  STEPS_PER_NON_LEAP_YEAR_15,
} from "../../../../packages/pv-core";
import {
  loadWpuqCohort,
  scaleProfileToAnnualKwh,
  WPUQ_COHORT_SIZE,
  WPUQ_PACKED_ANNUAL_KWH,
} from "./wpuqCohort";

function sum(arr: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

describe("WPuQ cohort pack", () => {
  it("loads exactly 27 profiles of 35040 steps packed at 5000 kWh", () => {
    const cohort = loadWpuqCohort();
    expect(cohort.profiles).toHaveLength(WPUQ_COHORT_SIZE);
    expect(cohort.houseIds).toHaveLength(WPUQ_COHORT_SIZE);
    expect(new Set(cohort.houseIds).size).toBe(WPUQ_COHORT_SIZE);

    for (const profile of cohort.profiles) {
      expect(profile.intervalEnergyKwh).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
      expect(sum(profile.intervalEnergyKwh)).toBeCloseTo(
        WPUQ_PACKED_ANNUAL_KWH,
        6
      );
    }
  });
});

describe("scaleProfileToAnnualKwh", () => {
  it("preserves shape and matches the customer annual household consumption", () => {
    const cohort = loadWpuqCohort();
    const target = 4321;
    const original = cohort.profiles[0].intervalEnergyKwh;
    const originalSum = sum(original);
    const scaled = scaleProfileToAnnualKwh(original, target, "SFH-test");

    expect(scaled).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    expect(sum(scaled)).toBeCloseTo(target, 8);

    const scale = target / originalSum;
    expect(scaled[0]).toBeCloseTo(original[0] * scale, 12);
    expect(scaled[1200]).toBeCloseTo(original[1200] * scale, 12);

    const other = scaleProfileToAnnualKwh(
      cohort.profiles[1].intervalEnergyKwh,
      target,
      "SFH-other"
    );
    expect(sum(other)).toBeCloseTo(target, 8);
    expect(other[0]).not.toBeCloseTo(scaled[0], 6);
  });
});
