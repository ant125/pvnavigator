import { describe, expect, it } from "vitest";
import {
  createUserLoadProfileForYear,
  iterateBdewProfileDays,
} from "./index";

const HOURS_PER_YEAR = 8760;
const WEATHER_YEARS = [2016, 2017, 2018, 2019, 2020] as const;
/** Strict relative tolerance for annual energy preservation. */
const ANNUAL_SUM_REL_TOL = 1e-12;

function sum(profile: number[]): number {
  return profile.reduce((a, b) => a + b, 0);
}

describe("createUserLoadProfileForYear", () => {
  it.each([...WEATHER_YEARS])(
    "year %i: length 8760 and annual sum equals 4500 kWh",
    (year) => {
      const profile = createUserLoadProfileForYear(4500, year);
      expect(profile).toHaveLength(HOURS_PER_YEAR);
      expect(Math.abs(sum(profile) - 4500)).toBeLessThanOrEqual(
        4500 * ANNUAL_SUM_REL_TOL
      );
      for (const v of profile) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  );

  it.each([...WEATHER_YEARS])(
    "year %i: scales generally for 7800 kWh annual demand",
    (year) => {
      const profile = createUserLoadProfileForYear(7800, year);
      expect(profile).toHaveLength(HOURS_PER_YEAR);
      expect(Math.abs(sum(profile) - 7800)).toBeLessThanOrEqual(
        7800 * ANNUAL_SUM_REL_TOL
      );
    }
  );

  it.each([...WEATHER_YEARS])(
    "year %i: civil day walk omits February 29 (8760h grid)",
    (year) => {
      const days = [...iterateBdewProfileDays(year)];
      expect(days).toHaveLength(365);
      expect(days.some((d) => d.month === 2 && d.day === 29)).toBe(false);
      expect(createUserLoadProfileForYear(4500, year)).toHaveLength(
        HOURS_PER_YEAR
      );
    }
  );

  it("rejects non-positive annual consumption", () => {
    expect(() => createUserLoadProfileForYear(0, 2018)).toThrow(
      /positive finite/
    );
    expect(() => createUserLoadProfileForYear(-100, 2018)).toThrow(
      /positive finite/
    );
    expect(() => createUserLoadProfileForYear(Number.NaN, 2018)).toThrow(
      /positive finite/
    );
  });
});
