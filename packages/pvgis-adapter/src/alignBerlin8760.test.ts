import { describe, expect, it } from "vitest";
import {
  alignPvgisRowsToBerlinLocal8760,
  HOURS_PER_NON_LEAP_YEAR,
  NON_LEAP_MONTH_LENGTHS,
  nonLeapCivilHourIndex,
  utcMsToBerlinLocalParts,
} from "./index";

const REL_TOL = 1e-9;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** PVGIS-style UTC timestamp YYYYMMDD:HHMM */
function utcTime(year: number, month: number, day: number, hour: number): string {
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

function sumPvKwh(rows: ReadonlyArray<{ pvKWh: number }>): number {
  return rows.reduce((a, r) => a + r.pvKWh, 0);
}

function expectedRetainedEnergyKwh(
  raw: ReadonlyArray<{ time?: string; P?: number }>
): { retained: number; skippedBerlinFeb29: number } {
  let retained = 0;
  let skipped = 0;
  for (const row of raw) {
    if (!row.time) continue;
    const year = Number(row.time.slice(0, 4));
    const monthUtc = Number(row.time.slice(4, 6));
    const dayUtc = Number(row.time.slice(6, 8));
    const hour = Number(row.time.slice(9, 11));
    const minute = Number(row.time.slice(11, 13));
    const utcMs = Date.UTC(year, monthUtc - 1, dayUtc, hour, minute);
    const berlin = utcMsToBerlinLocalParts(utcMs);
    const kwh = (typeof row.P === "number" ? row.P : 0) / 1000;
    if (berlin.month === 2 && berlin.day === 29) {
      skipped += 1;
      continue;
    }
    retained += kwh;
  }
  return { retained, skippedBerlinFeb29: skipped };
}

describe("nonLeapCivilHourIndex", () => {
  it("maps January 1 00:00 → 0", () => {
    expect(nonLeapCivilHourIndex(1, 1, 0)).toBe(0);
  });

  it("maps February 28 23:00 to the last February slot", () => {
    const idx = nonLeapCivilHourIndex(2, 28, 23);
    expect(idx).toBe((31 + 27) * 24 + 23);
  });

  it("maps March 1 00:00 immediately after February 28 23:00", () => {
    expect(nonLeapCivilHourIndex(3, 1, 0)).toBe(
      nonLeapCivilHourIndex(2, 28, 23) + 1
    );
  });

  it("maps December 31 23:00 → 8759", () => {
    expect(nonLeapCivilHourIndex(12, 31, 23)).toBe(8759);
  });

  it("rejects February 29", () => {
    expect(() => nonLeapCivilHourIndex(2, 29, 0)).toThrow(/February 29/);
  });

  it("rejects invalid month/day/hour", () => {
    expect(() => nonLeapCivilHourIndex(0, 1, 0)).toThrow(/month/);
    expect(() => nonLeapCivilHourIndex(13, 1, 0)).toThrow(/month/);
    expect(() => nonLeapCivilHourIndex(1, 32, 0)).toThrow(/day/);
    expect(() => nonLeapCivilHourIndex(4, 31, 0)).toThrow(/day/);
    expect(() => nonLeapCivilHourIndex(1, 1, -1)).toThrow(/hour/);
    expect(() => nonLeapCivilHourIndex(1, 1, 24)).toThrow(/hour/);
  });

  it("month lengths match non-leap grid", () => {
    expect(NON_LEAP_MONTH_LENGTHS[1]).toBe(28);
    expect(NON_LEAP_MONTH_LENGTHS.reduce((a, b) => a + b, 0)).toBe(365);
  });
});

describe("alignPvgisRowsToBerlinLocal8760 — non-leap", () => {
  it("2018: length 8760 and preserves retained annual energy", () => {
    const raw = generateUtcHourlyYear(2018, () => 1000); // 1 kWh per hour
    expect(raw).toHaveLength(8760);
    const aligned = alignPvgisRowsToBerlinLocal8760(raw);
    expect(aligned).toHaveLength(HOURS_PER_NON_LEAP_YEAR);
    const { retained, skippedBerlinFeb29 } = expectedRetainedEnergyKwh(raw);
    expect(skippedBerlinFeb29).toBe(0);
    expect(Math.abs(sumPvKwh(aligned) - retained)).toBeLessThanOrEqual(
      retained * REL_TOL + 1e-9
    );
  });
});

describe("alignPvgisRowsToBerlinLocal8760 — leap years", () => {
  it.each([2016, 2020] as const)(
    "%i: exclude exactly 24 Berlin Feb 29 hours; no roll into Mar 1; preserve retained",
    (year) => {
      const raw = generateUtcHourlyYear(year, (_i, _y, m, d, h) => {
        // Unique fingerprints for leap-day and Mar 1 slots
        if (m === 2 && d === 29) return 9000 + h; // UTC Feb 29
        if (m === 2 && d === 28 && h === 23) return 8000; // → Berlin Feb 29 00:00 CET
        if (m === 3 && d === 1 && h === 0) return 50; // UTC Mar 1 00 → Berlin Mar 1 01
        return 1000;
      });
      expect(raw).toHaveLength(8784);

      const { retained, skippedBerlinFeb29 } = expectedRetainedEnergyKwh(raw);
      expect(skippedBerlinFeb29).toBe(24);

      const aligned = alignPvgisRowsToBerlinLocal8760(raw);
      expect(aligned).toHaveLength(HOURS_PER_NON_LEAP_YEAR);
      expect(Math.abs(sumPvKwh(aligned) - retained)).toBeLessThanOrEqual(
        Math.abs(retained) * REL_TOL + 1e-6
      );

      // March 1 00:00 Berlin must not absorb Berlin-Feb-29 fingerprints.
      // UTC Feb 29 23:00 → Berlin Mar 1 00:00 (CET+1) is retained (not Feb 29 local).
      const mar1_00 = nonLeapCivilHourIndex(3, 1, 0);
      // Only UTC Feb 29 23:00 (P=9000+23) maps to Berlin Mar 1 00:00 among leap stamps.
      expect(aligned[mar1_00].pvKWh).toBeCloseTo((9000 + 23) / 1000, 9);

      // Feb 28 23:00 Berlin slot must not contain folded Feb 29 energy from skip policy.
      // UTC Feb 28 22:00 → Berlin Feb 28 23:00 (P=1000 default).
      const feb28_23 = nonLeapCivilHourIndex(2, 28, 23);
      expect(aligned[feb28_23].pvKWh).toBeCloseTo(1, 9);

      // Confirm no Berlin Feb 29 energy landed via Date rollover into Mar 1 daytime
      // by checking Mar 1 01:00 is only UTC Mar 1 00:00 (P=50).
      const mar1_01 = nonLeapCivilHourIndex(3, 1, 1);
      expect(aligned[mar1_01].pvKWh).toBeCloseTo(50 / 1000, 9);
    }
  );
});

describe("alignPvgisRowsToBerlinLocal8760 — DST fixed-grid", () => {
  it("spring 2018: missing Berlin 02:00 remains zero; retained energy preserved", () => {
    // Around 2018-03-25 DST start (CET→CEST)
    const raw = [
      { time: "20180325:0000", P: 1000 }, // Berlin 01:00
      { time: "20180325:0100", P: 2000 }, // Berlin 03:00 (02:00 skipped)
      { time: "20180325:0200", P: 3000 }, // Berlin 04:00
    ];
    const aligned = alignPvgisRowsToBerlinLocal8760(raw);
    const h01 = nonLeapCivilHourIndex(3, 25, 1);
    const h02 = nonLeapCivilHourIndex(3, 25, 2);
    const h03 = nonLeapCivilHourIndex(3, 25, 3);
    const h04 = nonLeapCivilHourIndex(3, 25, 4);
    expect(aligned[h01].pvKWh).toBeCloseTo(1, 9);
    expect(aligned[h02].pvKWh).toBe(0);
    expect(aligned[h03].pvKWh).toBeCloseTo(2, 9);
    expect(aligned[h04].pvKWh).toBeCloseTo(3, 9);
    expect(sumPvKwh(aligned)).toBeCloseTo(6, 9);
  });

  it("autumn 2018: repeated Berlin 02:00 accumulates both UTC intervals", () => {
    // 2018-10-28 DST end (CEST→CET): two UTC hours map to local 02:00
    const raw = [
      { time: "20181028:0000", P: 1000 }, // Berlin 02:00 CEST
      { time: "20181028:0100", P: 2500 }, // Berlin 02:00 CET
      { time: "20181028:0200", P: 4000 }, // Berlin 03:00 CET
    ];
    const aligned = alignPvgisRowsToBerlinLocal8760(raw);
    const h02 = nonLeapCivilHourIndex(10, 28, 2);
    const h03 = nonLeapCivilHourIndex(10, 28, 3);
    expect(aligned[h02].pvKWh).toBeCloseTo(1 + 2.5, 9);
    expect(aligned[h03].pvKWh).toBeCloseTo(4, 9);
    expect(sumPvKwh(aligned)).toBeCloseTo(7.5, 9);
  });
});

describe("multi-roof identical alignment", () => {
  it("aligns identical profiles the same way then sums index-by-index", () => {
    const raw = generateUtcHourlyYear(2016, (i) => 500 + (i % 17));
    const a = alignPvgisRowsToBerlinLocal8760(raw);
    const b = alignPvgisRowsToBerlinLocal8760(raw);
    expect(a).toHaveLength(8760);
    expect(b).toHaveLength(8760);
    const sum = a.map((row, i) => row.pvKWh + b[i].pvKWh);
    for (let i = 0; i < 8760; i++) {
      expect(sum[i]).toBeCloseTo(2 * a[i].pvKWh, 9);
    }
  });

  it("length mismatch for index sum is detected by caller convention", () => {
    const a = alignPvgisRowsToBerlinLocal8760([
      { time: "20180101:0000", P: 1000 },
    ]);
    const short = [1, 2, 3];
    expect(a.length).not.toBe(short.length);
    expect(a).toHaveLength(8760);
  });
});
