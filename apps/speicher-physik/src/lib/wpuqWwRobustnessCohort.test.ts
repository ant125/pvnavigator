import { describe, expect, it } from "vitest";
import { STEPS_PER_NON_LEAP_YEAR_15 } from "../../../../packages/pv-core";
import { scaleUniformEnergy } from "@heatpump-profile/loader";
import {
  loadWpuqWwRobustnessCohort,
  WPUQ_WW_ROBUSTNESS_SIZE,
} from "./wpuqWwRobustnessCohort";
import { metricAggregate, buildWwRobustnessPayload } from "./wpuqWwRobustnessStats";

function sum(arr: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

describe("WPuQ WW robustness cohort pack", () => {
  it("loads exactly 24 independent unit-weight profiles of 35040 steps", () => {
    const cohort = loadWpuqWwRobustnessCohort();
    expect(cohort.profiles).toHaveLength(WPUQ_WW_ROBUSTNESS_SIZE);
    expect(cohort.houseIds).toHaveLength(WPUQ_WW_ROBUSTNESS_SIZE);
    expect(cohort.profileIds).toHaveLength(WPUQ_WW_ROBUSTNESS_SIZE);
    expect(new Set(cohort.houseIds).size).toBe(WPUQ_WW_ROBUSTNESS_SIZE);
    expect(new Set(cohort.profileIds).size).toBe(WPUQ_WW_ROBUSTNESS_SIZE);

    for (const profile of cohort.profiles) {
      expect(profile.weights).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
      expect(sum(profile.weights)).toBeCloseTo(1, 6);
      expect(profile.profileId).toMatch(/^ww-wpuq-2019-sfh\d{2}-v1$/);
      expect(profile.houseId).toMatch(/^SFH\d+$/);
    }

    expect(cohort.profileIds).toContain("ww-wpuq-2019-sfh38-v1");
    expect(cohort.houseIds).toContain("SFH38");
  });
});

describe("WW uniform scaling", () => {
  it("preserves shape and matches the customer annual HP consumption", () => {
    const cohort = loadWpuqWwRobustnessCohort();
    const target = 3456;
    const original = Array.from(cohort.profiles[0].weights);
    const { profile, scaleFactor } = scaleUniformEnergy(original, target);

    expect(profile).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    expect(sum(profile)).toBeCloseTo(target, 8);
    expect(scaleFactor).toBeCloseTo(target / sum(original), 12);
    expect(profile[0]).toBeCloseTo(original[0] * scaleFactor, 12);
    expect(profile[1200]).toBeCloseTo(original[1200] * scaleFactor, 12);

    const other = scaleUniformEnergy(
      Array.from(cohort.profiles[1].weights),
      target
    );
    expect(sum(other.profile)).toBeCloseTo(target, 8);
    expect(other.profile[0]).not.toBeCloseTo(profile[0], 6);
  });
});

describe("WW robustness aggregates", () => {
  it("reports min max median mean", () => {
    const agg = metricAggregate([1, 2, 3, 4]);
    expect(agg.min).toBe(1);
    expect(agg.max).toBe(4);
    expect(agg.median).toBe(2.5);
    expect(agg.mean).toBe(2.5);
  });

  it("buildWwRobustnessPayload stores profile id, house id, and aggregates", () => {
    const payload = buildWwRobustnessPayload({
      heatPumpAnnualKwh: 3000,
      productionTechnicalSizeKwh: 10,
      profiles: [
        {
          profileId: "ww-wpuq-2019-sfh03-v1",
          houseId: "SFH3",
          technicalSpeichergrenzeKwh: 10,
          eigenverbrauchKwh: 100,
          eigenverbrauchsquotePct: 40,
          autarkiePct: 50,
          netzbezugKwh: 200,
          einspeisungKwh: 300,
        },
        {
          profileId: "ww-wpuq-2019-sfh04-v1",
          houseId: "SFH4",
          technicalSpeichergrenzeKwh: 15,
          eigenverbrauchKwh: 120,
          eigenverbrauchsquotePct: 45,
          autarkiePct: 55,
          netzbezugKwh: 180,
          einspeisungKwh: 280,
        },
      ],
    });

    expect(payload.cohortSize).toBe(2);
    expect(payload.sizeUnchangedCount).toBe(1);
    expect(payload.profiles[0].profileId).toBe("ww-wpuq-2019-sfh03-v1");
    expect(payload.aggregates.eigenverbrauchKwh.min).toBe(100);
    expect(payload.aggregates.eigenverbrauchKwh.max).toBe(120);
    expect(payload.aggregates.eigenverbrauchKwh.mean).toBe(110);
    expect(payload.aggregates.eigenverbrauchKwh.median).toBe(110);
  });
});
