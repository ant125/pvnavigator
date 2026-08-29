import { describe, expect, it } from "vitest";
import {
  STEPS_PER_HOUR_15,
  STEPS_PER_NON_LEAP_YEAR_15,
  expandHourlyEnergyToQuarterHours,
} from "../../pv-core/src/quarterHourGrid";
import {
  expandAlignedPvgisHourlyByYear,
  expandAlignedPvgisHourlyToQuarterHours,
} from "./expandAlignedHourly";
import {
  alignPvgisRowsToBerlinLocal8760,
  HOURS_PER_NON_LEAP_YEAR,
  nonLeapCivilHourIndex,
} from "./index";

const REL_TOL = 1e-12;

function sum(a: readonly number[]): number {
  return a.reduce((s, x) => s + x, 0);
}

function kwhOf(aligned: ReadonlyArray<{ pvKWh: number }>): number[] {
  return aligned.map((r) => r.pvKWh);
}

describe("expandAlignedPvgisHourlyToQuarterHours", () => {
  it("requires the aligned 8760 grid", () => {
    expect(() => expandAlignedPvgisHourlyToQuarterHours([1, 2, 3])).toThrow(
      /8760/
    );
  });

  it("E: DST spring zero hour becomes four zero quarter-hours", () => {
    const raw = [
      { time: "20180325:0000", P: 1000 },
      { time: "20180325:0100", P: 2000 },
      { time: "20180325:0200", P: 3000 },
    ];
    const aligned = alignPvgisRowsToBerlinLocal8760(raw);
    const hourly = kwhOf(aligned);
    const h02 = nonLeapCivilHourIndex(3, 25, 2);
    expect(hourly[h02]).toBe(0);

    const qh = expandAlignedPvgisHourlyToQuarterHours(hourly);
    expect(qh).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    const base = h02 * STEPS_PER_HOUR_15;
    expect(qh.slice(base, base + STEPS_PER_HOUR_15)).toEqual([0, 0, 0, 0]);
  });

  it("F: DST autumn accumulated hour keeps the same total energy after split", () => {
    const raw = [
      { time: "20181028:0000", P: 1000 },
      { time: "20181028:0100", P: 2500 },
      { time: "20181028:0200", P: 4000 },
    ];
    const aligned = alignPvgisRowsToBerlinLocal8760(raw);
    const hourly = kwhOf(aligned);
    const h02 = nonLeapCivilHourIndex(10, 28, 2);
    expect(hourly[h02]).toBeCloseTo(3.5, 9);

    const qh = expandAlignedPvgisHourlyToQuarterHours(hourly);
    const base = h02 * STEPS_PER_HOUR_15;
    const hourSum =
      qh[base] + qh[base + 1] + qh[base + 2] + qh[base + 3];
    expect(Math.abs(hourSum - hourly[h02])).toBeLessThanOrEqual(
      hourly[h02] * REL_TOL + 1e-15
    );
    expect(Math.abs(sum(qh) - sum(hourly))).toBeLessThanOrEqual(
      sum(hourly) * REL_TOL + 1e-12
    );
  });

  it("leap-year aligned 8760 still expands to 35040 without restoring Feb 29", () => {
    const raw = [{ time: "20160229:1200", P: 9000 }, { time: "20160301:0000", P: 1000 }];
    const aligned = alignPvgisRowsToBerlinLocal8760(raw);
    expect(aligned).toHaveLength(HOURS_PER_NON_LEAP_YEAR);
    const qh = expandAlignedPvgisHourlyToQuarterHours(kwhOf(aligned));
    expect(qh).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    expect(Math.abs(sum(qh) - sum(kwhOf(aligned)))).toBeLessThanOrEqual(1e-12);
  });
});

describe("multi-roof: sum hourly then expand", () => {
  it("equals expand each surface then sum (linearity)", () => {
    const rawA = [
      { time: "20180101:0000", P: 1000 },
      { time: "20180101:0100", P: 4000 },
    ];
    const rawB = [
      { time: "20180101:0000", P: 2500 },
      { time: "20180101:0100", P: 500 },
    ];
    const a = kwhOf(alignPvgisRowsToBerlinLocal8760(rawA));
    const b = kwhOf(alignPvgisRowsToBerlinLocal8760(rawB));
    const summedHourly = a.map((v, i) => v + b[i]);

    const sumThenExpand = expandAlignedPvgisHourlyToQuarterHours(summedHourly);
    const expandThenSum = expandHourlyEnergyToQuarterHours(a).map(
      (v, i) => v + expandHourlyEnergyToQuarterHours(b)[i]
    );

    expect(sumThenExpand).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    let maxAbs = 0;
    for (let i = 0; i < sumThenExpand.length; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(sumThenExpand[i] - expandThenSum[i]));
    }
    expect(maxAbs).toBeLessThanOrEqual(1e-15);
  });

  it("expandAlignedPvgisHourlyByYear expands each weather year", () => {
    const hourly = new Array<number>(HOURS_PER_NON_LEAP_YEAR).fill(0);
    hourly[0] = 8;
    const qhByYear = expandAlignedPvgisHourlyByYear({ 2018: hourly, 2019: hourly });
    expect(qhByYear[2018]).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
    expect(qhByYear[2019][0]).toBeCloseTo(2, 12);
    expect(qhByYear[2018].slice(0, 4)).toEqual([2, 2, 2, 2]);
  });
});
