import { describe, expect, it } from "vitest";
import {
  alignMultiYearPvgisRowsByUtcYear,
  alignPvgisRowsToBerlinLocal8760,
  bucketPvgisRowsByUtcYear,
  HOURS_PER_NON_LEAP_YEAR,
  nonLeapCivilHourIndex,
  pvgisFetchTimeoutMs,
} from "./index";

const REL_TOL = 1e-9;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** PVGIS-style UTC timestamp YYYYMMDD:HHMM */
function utcTime(
  year: number,
  month: number,
  day: number,
  hour: number
): string {
  return `${year}${pad2(month)}${pad2(day)}:${pad2(hour)}00`;
}

function generateUtcHourlyYear(
  year: number,
  watts: (i: number, y: number, m: number, d: number, h: number) => number
): Array<{ time: string; P: number }> {
  const rows: Array<{ time: string; P: number }> = [];
  const leap = isLeapYear(year);
  const monthLens = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let i = 0;
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= monthLens[m - 1]; d++) {
      for (let h = 0; h < 24; h++) {
        rows.push({
          time: utcTime(year, m, d, h),
          P: watts(i, year, m, d, h),
        });
        i += 1;
      }
    }
  }
  return rows;
}

function profilesClose(
  a: number[],
  b: number[],
  label: string
): void {
  expect(a, label).toHaveLength(HOURS_PER_NON_LEAP_YEAR);
  expect(b, label).toHaveLength(HOURS_PER_NON_LEAP_YEAR);
  for (let i = 0; i < HOURS_PER_NON_LEAP_YEAR; i++) {
    expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(
      Math.max(Math.abs(a[i]), Math.abs(b[i])) * REL_TOL + 1e-12
    );
  }
}

function sumHourly(profiles: readonly (readonly number[])[]): number[] {
  const n = profiles[0].length;
  const out = new Array<number>(n).fill(0);
  for (const p of profiles) {
    for (let i = 0; i < n; i++) out[i] += p[i];
  }
  return out;
}

describe("pvgisFetchTimeoutMs", () => {
  it("keeps 10s for a single year", () => {
    expect(pvgisFetchTimeoutMs(2018, 2018)).toBe(10_000);
  });

  it("scales modestly for 2016–2020 and caps at 30s", () => {
    // 5 years → 10s + 4×4s = 26s
    expect(pvgisFetchTimeoutMs(2016, 2020)).toBe(26_000);
    expect(pvgisFetchTimeoutMs(2006, 2020)).toBe(30_000);
  });
});

describe("bucketPvgisRowsByUtcYear", () => {
  it("buckets by UTC year prefix and skips invalid times", () => {
    const rows = [
      { time: "20160101:0000", P: 1 },
      { time: "20170101:0000", P: 2 },
      { time: "20160101:0100", P: 3 },
      { time: undefined, P: 9 },
      { time: "bad", P: 9 },
    ];
    const buckets = bucketPvgisRowsByUtcYear(rows);
    expect([...buckets.keys()].sort()).toEqual([2016, 2017]);
    expect(buckets.get(2016)).toHaveLength(2);
    expect(buckets.get(2017)).toHaveLength(1);
  });
});

describe("alignMultiYearPvgisRowsByUtcYear — equivalence vs single-year", () => {
  const YEARS = [2016, 2017, 2018, 2019, 2020] as const;

  /** Year-fingerprinted watts so superposition would be detectable. */
  function yearFingerprintWatts(
    _i: number,
    y: number,
    m: number,
    d: number,
    h: number
  ): number {
    // Unique annual offset + mild seasonal/diurnal shape
    return y * 10 + m + (d % 7) + (h % 5);
  }

  it(
    "each year from 2016–2020 multi-year equals its single-year align path",
    () => {
      const perYearRaw = new Map(
        YEARS.map((y) => [y, generateUtcHourlyYear(y, yearFingerprintWatts)])
      );
      const concatenated = YEARS.flatMap((y) => perYearRaw.get(y)!);

      const fromMulti = alignMultiYearPvgisRowsByUtcYear(concatenated);

      for (const year of YEARS) {
        expect(fromMulti[year]).toHaveLength(HOURS_PER_NON_LEAP_YEAR);
        const single = alignPvgisRowsToBerlinLocal8760(
          perYearRaw.get(year)!
        ).map((r) => r.pvKWh);
        profilesClose(fromMulti[year], single, `year ${year}`);
      }
    },
    30_000
  );

  it("includes leap year 2016 and non-leap 2018 with matching energy", () => {
    const y2016 = generateUtcHourlyYear(2016, () => 1000);
    const y2018 = generateUtcHourlyYear(2018, () => 1000);
    expect(y2016).toHaveLength(8784);
    expect(y2018).toHaveLength(8760);

    const multi = alignMultiYearPvgisRowsByUtcYear([...y2016, ...y2018]);
    const single2016 = alignPvgisRowsToBerlinLocal8760(y2016).map(
      (r) => r.pvKWh
    );
    const single2018 = alignPvgisRowsToBerlinLocal8760(y2018).map(
      (r) => r.pvKWh
    );

    profilesClose(multi[2016], single2016, "2016 leap");
    profilesClose(multi[2018], single2018, "2018 non-leap");
  });

  it("preserves DST spring gap and autumn accumulation when split from multi-year", () => {
    // Spring 2018 (CET→CEST) + autumn 2018 (CEST→CET), embedded in a 2016–2018 blob
    const springAutumn2018 = [
      { time: "20180325:0000", P: 1000 }, // Berlin 01:00
      { time: "20180325:0100", P: 2000 }, // Berlin 03:00 (02:00 skipped)
      { time: "20180325:0200", P: 3000 }, // Berlin 04:00
      { time: "20181028:0000", P: 1000 }, // Berlin 02:00 CEST
      { time: "20181028:0100", P: 2500 }, // Berlin 02:00 CET
      { time: "20181028:0200", P: 4000 }, // Berlin 03:00 CET
    ];
    const decoy2016 = [{ time: "20160615:1200", P: 9999 }];
    const decoy2017 = [{ time: "20170615:1200", P: 8888 }];

    const multi = alignMultiYearPvgisRowsByUtcYear([
      ...decoy2016,
      ...decoy2017,
      ...springAutumn2018,
    ]);
    const single = alignPvgisRowsToBerlinLocal8760(springAutumn2018);

    const h02_spring = nonLeapCivilHourIndex(3, 25, 2);
    const h02_autumn = nonLeapCivilHourIndex(10, 28, 2);
    expect(multi[2018][h02_spring]).toBe(0);
    expect(multi[2018][h02_autumn]).toBeCloseTo(1 + 2.5, 9);
    expect(multi[2018][h02_spring]).toBe(single[h02_spring].pvKWh);
    expect(multi[2018][h02_autumn]).toBeCloseTo(single[h02_autumn].pvKWh, 9);

    // Decoy years must not leak into 2018
    const jun15_12 = nonLeapCivilHourIndex(6, 15, 12);
    // UTC Jun 15 12:00 → Berlin Jun 15 14:00 (CEST)
    const jun15_14 = nonLeapCivilHourIndex(6, 15, 14);
    expect(multi[2018][jun15_12]).toBe(0);
    expect(multi[2018][jun15_14]).toBe(0);
    expect(multi[2016][jun15_14]).toBeCloseTo(9.999, 6);
  });

  it("does not superimpose years onto one 8760 grid", () => {
    const a = generateUtcHourlyYear(2016, () => 1000); // 1 kWh/h retained
    const b = generateUtcHourlyYear(2017, () => 2000); // 2 kWh/h
    const wronglyAlignedTogether = alignPvgisRowsToBerlinLocal8760([
      ...a,
      ...b,
    ]);
    const correctlySplit = alignMultiYearPvgisRowsByUtcYear([...a, ...b]);

    const sumTogether = wronglyAlignedTogether.reduce(
      (s, r) => s + r.pvKWh,
      0
    );
    const sumSplit =
      correctlySplit[2016].reduce((s, v) => s + v, 0) +
      correctlySplit[2017].reduce((s, v) => s + v, 0);

    // Superimposed path still totals energy, but per-slot values differ
    expect(sumTogether).toBeCloseTo(sumSplit, 6);
    expect(correctlySplit[2016][0]).toBeCloseTo(1, 9);
    expect(correctlySplit[2017][0]).toBeCloseTo(2, 9);
    // Superimposed Jan 1 00 would be 1+2 = 3
    expect(wronglyAlignedTogether[0].pvKWh).toBeCloseTo(3, 9);
    expect(correctlySplit[2016][0]).not.toBeCloseTo(
      wronglyAlignedTogether[0].pvKWh,
      3
    );
  });

  it(
    "multi-surface year summation matches old per-year architecture",
    () => {
      // Old: 5 separate yearly profiles per surface, then sum
      // New: one 2016–2020 blob per surface → split → sum year-by-year
      const surfaces = [
        (y: number) =>
          generateUtcHourlyYear(y, (_i, _yy, m, d, h) => 100 + y + m + d + h),
        (y: number) =>
          generateUtcHourlyYear(y, (_i, _yy, m, d, h) => 50 + y * 2 + m + h),
        (y: number) =>
          generateUtcHourlyYear(y, (_i, _yy, m, d, h) => 25 + (y % 7) + d),
      ];

      const oldByYear: Record<number, number[]> = {};
      for (const year of YEARS) {
        const profiles = surfaces.map((gen) =>
          alignPvgisRowsToBerlinLocal8760(gen(year)).map((r) => r.pvKWh)
        );
        oldByYear[year] = sumHourly(profiles);
      }

      const newByYear: Record<number, number[]> = {};
      const perSurfaceMulti = surfaces.map((gen) => {
        const concat = YEARS.flatMap((y) => gen(y));
        return alignMultiYearPvgisRowsByUtcYear(concat);
      });
      for (const year of YEARS) {
        newByYear[year] = sumHourly(
          perSurfaceMulti.map((byYear) => byYear[year])
        );
      }

      for (const year of YEARS) {
        profilesClose(oldByYear[year], newByYear[year], `surfaces ${year}`);
      }
    },
    60_000
  );

  it("returns exactly 8760 values for every year in the range", () => {
    const concat = YEARS.flatMap((y) =>
      generateUtcHourlyYear(y, (_i, yy) => yy)
    );
    const byYear = alignMultiYearPvgisRowsByUtcYear(concat);
    expect(Object.keys(byYear).map(Number).sort()).toEqual([...YEARS]);
    for (const year of YEARS) {
      expect(byYear[year]).toHaveLength(8760);
      expect(byYear[year].every((v) => Number.isFinite(v) && v >= 0)).toBe(
        true
      );
    }
  });
});
