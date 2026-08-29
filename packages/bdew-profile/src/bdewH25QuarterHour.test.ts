import { describe, expect, it } from "vitest";
import { BDEW_H0 } from "./bdew_h0";
import {
  buildBdewH0WeightsForYear,
  classifyBdewDayTypeEuropeBerlin,
  iterateBdewProfileDays,
} from "./bdewH0YearProfile";
import {
  aggregateQuarterHoursToHourly,
  BDEW_H25_SLOT_LABELS,
  BDEW_H25_SLOTS_PER_DAY,
  BDEW_H25_SOURCE,
  BDEW_H25_STEPS_PER_NON_LEAP_YEAR,
  BDEW_H25_TEMPLATES,
  buildBdewH25QuarterHourWeightsForYear,
  createUserLoadProfile15MinForYear,
  h25SourceDayTypeFromCalendar,
} from "./bdewH25QuarterHour";
import { createUserLoadProfileForYear } from "./index";

const ANNUAL_SUM_REL_TOL = 1e-12;
const WEATHER_YEARS = Array.from(
  { length: 2020 - 2006 + 1 },
  (_, i) => 2006 + i
);

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function dayIndex(
  year: number,
  month: number,
  day: number
): number {
  let i = 0;
  for (const d of iterateBdewProfileDays(year)) {
    if (d.month === month && d.day === day) return i;
    i += 1;
  }
  throw new Error(`Day ${year}-${month}-${day} not in profile calendar`);
}

function sliceDay(profile: number[], dayIdx: number): number[] {
  const start = dayIdx * BDEW_H25_SLOTS_PER_DAY;
  return profile.slice(start, start + BDEW_H25_SLOTS_PER_DAY);
}

describe("BDEW H25 quarter-hour source artifact", () => {
  it("A: encodes 96 quarter-hour slots covering a civil day", () => {
    expect(BDEW_H25_SLOT_LABELS).toHaveLength(96);
    expect(BDEW_H25_SLOTS_PER_DAY).toBe(96);
    expect(BDEW_H25_SLOT_LABELS[0]).toBe("00:00-00:15");
    expect(BDEW_H25_SLOT_LABELS[95]).toBe("23:45-00:00");
    expect(BDEW_H25_SOURCE.slotsPerDay).toBe(96);
    expect(BDEW_H25_SOURCE.sheetName).toBe("H25");
    expect(BDEW_H25_SOURCE.profileKey).toBe("H25");
  });

  it("B: has 12 months × 3 source day types × 96 slots", () => {
    let n = 0;
    for (let month = 1; month <= 12; month++) {
      const t = BDEW_H25_TEMPLATES[month];
      expect(t).toBeDefined();
      for (const typ of ["WT", "SA", "FT"] as const) {
        expect(t[typ]).toHaveLength(96);
        n += t[typ].length;
        for (const v of t[typ]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    }
    expect(n).toBe(12 * 3 * 96);
  });

  it("J: Dynamisierung was not applied", () => {
    expect(BDEW_H25_SOURCE.dynamisierungApplied).toBe(false);
    // Monthly templates: two January weekdays in 2025 are identical.
    // A day-of-year Dynamisierung unroll would make them differ.
    const y = buildBdewH25QuarterHourWeightsForYear(2025);
    const jan1 = sliceDay(y, dayIndex(2025, 1, 1));
    const jan2 = sliceDay(y, dayIndex(2025, 1, 2));
    expect(classifyBdewDayTypeEuropeBerlin(2025, 1, 1)).toBe("WD");
    expect(classifyBdewDayTypeEuropeBerlin(2025, 1, 2)).toBe("WD");
    expect(jan1).toEqual(jan2);
    expect(jan1).toEqual([...BDEW_H25_TEMPLATES[1].WT]);
  });
});

describe("buildBdewH25QuarterHourWeightsForYear", () => {
  it("C: each weather year is 35040 steps and omits 29 Feb", () => {
    for (const year of WEATHER_YEARS) {
      const profile = buildBdewH25QuarterHourWeightsForYear(year);
      expect(profile).toHaveLength(BDEW_H25_STEPS_PER_NON_LEAP_YEAR);
      expect(profile).toHaveLength(365 * 96);
      expect([...iterateBdewProfileDays(year)]).toHaveLength(365);
    }
  });

  it("D: 2025 reference year sums to 1e6 kWh", () => {
    const profile = buildBdewH25QuarterHourWeightsForYear(2025);
    expect(Math.abs(sum(profile) - 1_000_000)).toBeLessThanOrEqual(1e-6);
  });

  it("G: Sunday uses the FT template", () => {
    expect(h25SourceDayTypeFromCalendar("SU")).toBe("FT");
    expect(classifyBdewDayTypeEuropeBerlin(2025, 1, 5)).toBe("SU");
    const y = buildBdewH25QuarterHourWeightsForYear(2025);
    const sunday = sliceDay(y, dayIndex(2025, 1, 5));
    expect(sunday).toEqual([...BDEW_H25_TEMPLATES[1].FT]);
    expect(sunday).not.toEqual([...BDEW_H25_TEMPLATES[1].WT]);
  });

  it("H: Saturday uses the SA template", () => {
    expect(h25SourceDayTypeFromCalendar("SA")).toBe("SA");
    expect(classifyBdewDayTypeEuropeBerlin(2025, 1, 4)).toBe("SA");
    const y = buildBdewH25QuarterHourWeightsForYear(2025);
    const saturday = sliceDay(y, dayIndex(2025, 1, 4));
    expect(saturday).toEqual([...BDEW_H25_TEMPLATES[1].SA]);
  });

  it("I: ordinary weekday uses the WT template", () => {
    expect(h25SourceDayTypeFromCalendar("WD")).toBe("WT");
    expect(classifyBdewDayTypeEuropeBerlin(2025, 1, 1)).toBe("WD");
    const y = buildBdewH25QuarterHourWeightsForYear(2025);
    const wednesday = sliceDay(y, dayIndex(2025, 1, 1));
    expect(wednesday).toEqual([...BDEW_H25_TEMPLATES[1].WT]);
  });

  it("K: 25.12.2025 stays weekday WT (no holiday remap)", () => {
    expect(BDEW_H25_SOURCE.weekdayHolidayRemap).toBe(false);
    expect(classifyBdewDayTypeEuropeBerlin(2025, 12, 25)).toBe("WD");
    const y = buildBdewH25QuarterHourWeightsForYear(2025);
    const christmas = sliceDay(y, dayIndex(2025, 12, 25));
    expect(christmas).toEqual([...BDEW_H25_TEMPLATES[12].WT]);
    expect(christmas).not.toEqual([...BDEW_H25_TEMPLATES[12].FT]);
  });
});

describe("createUserLoadProfile15MinForYear", () => {
  it("E: 5000 kWh input sums to 5000 kWh at 35040 steps", () => {
    const profile = createUserLoadProfile15MinForYear(5000, 2018);
    expect(profile).toHaveLength(35040);
    expect(Math.abs(sum(profile) - 5000)).toBeLessThanOrEqual(
      5000 * ANNUAL_SUM_REL_TOL
    );
  });

  it("rejects non-positive annual consumption", () => {
    expect(() => createUserLoadProfile15MinForYear(0, 2018)).toThrow(
      /positive finite/
    );
    expect(() => createUserLoadProfile15MinForYear(-1, 2018)).toThrow(
      /positive finite/
    );
  });
});

describe("F: 4 quarter-hours reconstruct the hourly reference", () => {
  it("2025 aggregated H25 matches BDEW_H0 (hourly CSV embed)", () => {
    const qh = buildBdewH25QuarterHourWeightsForYear(2025);
    const hourlyFromQh = aggregateQuarterHoursToHourly(qh);
    expect(BDEW_H0).toHaveLength(8760);
    expect(hourlyFromQh).toHaveLength(8760);

    let maxAbs = 0;
    let maeAcc = 0;
    for (let i = 0; i < 8760; i++) {
      const d = Math.abs(hourlyFromQh[i] - BDEW_H0[i]);
      if (d > maxAbs) maxAbs = d;
      maeAcc += d;
    }
    const mae = maeAcc / 8760;
    const annualDiff = sum(hourlyFromQh) - sum(BDEW_H0);

    // eslint-disable-next-line no-console
    console.log(
      `H25 4QH→hourly vs BDEW_H0: maxAbs=${maxAbs} MAE=${mae} annualDiff=${annualDiff}`
    );

    expect(maxAbs).toBeLessThan(1e-9);
    expect(mae).toBeLessThan(1e-10);
    expect(Math.abs(annualDiff)).toBeLessThan(1e-6);
  });

  it("remapped weather years match hourly createUserLoadProfileForYear after 4QH sum", () => {
    for (const year of [2008, 2018, 2020]) {
      const hourly = buildBdewH0WeightsForYear(year);
      const fromQh = aggregateQuarterHoursToHourly(
        buildBdewH25QuarterHourWeightsForYear(year)
      );
      let maxAbs = 0;
      for (let i = 0; i < 8760; i++) {
        const d = Math.abs(fromQh[i] - hourly[i]);
        if (d > maxAbs) maxAbs = d;
      }
      expect(maxAbs).toBeLessThan(1e-9);
      expect(createUserLoadProfileForYear(5000, year)).toHaveLength(8760);
    }
  });
});
