import { describe, expect, it } from "vitest";
import {
  STEPS_PER_DAY_15,
  STEPS_PER_HOUR_15,
  STEPS_PER_NON_LEAP_YEAR_15,
  TIME_STEP_HOURS_15,
  TIME_STEP_MINUTES_15,
  expandHourlyEnergyToQuarterHours,
  expandHourlyEnergyToQuarterHoursByYear,
  expectedStepsPerYearForTimeStepHours,
} from "./quarterHourGrid";

const HOURS_PER_NON_LEAP_YEAR = 8760;
const REL_TOL = 1e-12;

function sum(a: readonly number[]): number {
  return a.reduce((s, x) => s + x, 0);
}

function sumHourlyProfiles(
  profiles: readonly (readonly number[])[]
): number[] {
  const n = profiles[0].length;
  const out = new Array<number>(n).fill(0);
  for (const p of profiles) {
    for (let i = 0; i < n; i++) out[i] += p[i];
  }
  return out;
}

describe("quarter-hour grid constants", () => {
  it("are internally consistent (no magic 4 / 96 / 35040 elsewhere)", () => {
    expect(TIME_STEP_MINUTES_15).toBe(15);
    expect(TIME_STEP_HOURS_15).toBe(0.25);
    expect(STEPS_PER_HOUR_15).toBe(4);
    expect(STEPS_PER_DAY_15).toBe(24 * STEPS_PER_HOUR_15);
    expect(STEPS_PER_NON_LEAP_YEAR_15).toBe(365 * STEPS_PER_DAY_15);
    expect(STEPS_PER_NON_LEAP_YEAR_15).toBe(
      HOURS_PER_NON_LEAP_YEAR * STEPS_PER_HOUR_15
    );
    expect(expectedStepsPerYearForTimeStepHours(1)).toBe(8760);
    expect(expectedStepsPerYearForTimeStepHours(TIME_STEP_HOURS_15)).toBe(35040);
    expect(() => expectedStepsPerYearForTimeStepHours(0.5)).toThrow(
      /unsupported timeStepHours/
    );
  });
});

describe("expandHourlyEnergyToQuarterHours", () => {
  it("A: 8760 hourly values become 35040 quarter-hours", () => {
    const hourly = Array.from({ length: HOURS_PER_NON_LEAP_YEAR }, (_, i) =>
      i % 17 === 0 ? 0 : (i % 13) + 0.25
    );
    const qh = expandHourlyEnergyToQuarterHours(hourly);
    expect(qh).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
  });

  it("B: each hour’s four quarter-hours sum to that hour", () => {
    const hourly = Array.from(
      { length: HOURS_PER_NON_LEAP_YEAR },
      (_, i) => (i * 0.017) % 4.2
    );
    const qh = expandHourlyEnergyToQuarterHours(hourly);
    for (let h = 0; h < HOURS_PER_NON_LEAP_YEAR; h++) {
      const base = h * STEPS_PER_HOUR_15;
      const hourSum = qh[base] + qh[base + 1] + qh[base + 2] + qh[base + 3];
      expect(Math.abs(hourSum - hourly[h])).toBeLessThanOrEqual(
        Math.abs(hourly[h]) * REL_TOL + 1e-15
      );
    }
  });

  it("C: annual sum is identical", () => {
    const hourly = Array.from(
      { length: HOURS_PER_NON_LEAP_YEAR },
      (_, i) => (i % 11) * 0.5
    );
    const qh = expandHourlyEnergyToQuarterHours(hourly);
    expect(Math.abs(sum(qh) - sum(hourly))).toBeLessThanOrEqual(
      Math.abs(sum(hourly)) * REL_TOL + 1e-12
    );
  });

  it("D: a zero hour becomes four zeros", () => {
    const hourly = [1, 0, 2];
    const qh = expandHourlyEnergyToQuarterHours(hourly);
    expect(qh.slice(4, 8)).toEqual([0, 0, 0, 0]);
  });

  it("rejects empty, negative, or non-finite input", () => {
    expect(() => expandHourlyEnergyToQuarterHours([])).toThrow(/empty/);
    expect(() => expandHourlyEnergyToQuarterHours([1, -0.1])).toThrow(/invalid/);
    expect(() => expandHourlyEnergyToQuarterHours([Number.NaN])).toThrow(
      /invalid/
    );
  });

  it("sum-then-expand equals expand-then-sum (linear, prefer sum hourly first)", () => {
    const a = Array.from({ length: 48 }, (_, i) => (i % 5) + 0.1);
    const b = Array.from({ length: 48 }, (_, i) => (i % 7) * 0.2);
    const sumThenExpand = expandHourlyEnergyToQuarterHours(
      sumHourlyProfiles([a, b])
    );
    const expandThenSum = sumHourlyProfiles([
      expandHourlyEnergyToQuarterHours(a),
      expandHourlyEnergyToQuarterHours(b),
    ]);
    expect(expandThenSum).toHaveLength(sumThenExpand.length);
    for (let i = 0; i < sumThenExpand.length; i++) {
      expect(Math.abs(sumThenExpand[i] - expandThenSum[i])).toBeLessThanOrEqual(
        1e-15
      );
    }
  });

  it("expandHourlyEnergyToQuarterHoursByYear maps each year independently", () => {
    const hourly2018 = [1, 2, 3];
    const hourly2019 = [0, 4, 0];
    const qh = expandHourlyEnergyToQuarterHoursByYear({
      2018: hourly2018,
      2019: hourly2019,
    });
    expect(qh[2018]).toEqual(expandHourlyEnergyToQuarterHours(hourly2018));
    expect(qh[2019]).toEqual(expandHourlyEnergyToQuarterHours(hourly2019));
  });
});
