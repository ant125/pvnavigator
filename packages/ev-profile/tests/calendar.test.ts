import { classifyBdewDayTypeEuropeBerlin } from "@bdew-profile/loader/calendar";
import { describe, expect, it } from "vitest";
import { createEvProfile, EV_STEPS_PER_NON_LEAP_YEAR } from "../src/index";
import { buildEvModelDays, countEvDayTypes } from "../src/calendar";
import { commuterInput } from "./helpers";

describe("EV calendar", () => {
  it("uses 365 modelled days and 35 040 slots, omitting 29 February", () => {
    for (const year of [2008, 2012, 2016, 2018, 2020]) {
      const days = buildEvModelDays(year);
      expect(days).toHaveLength(365);
      expect(days.some((d) => d.month === 2 && d.day === 29)).toBe(false);
      const result = createEvProfile(commuterInput({ year }));
      expect(result.profile).toHaveLength(EV_STEPS_PER_NON_LEAP_YEAR);
      expect(result.meta.steps).toBe(EV_STEPS_PER_NON_LEAP_YEAR);
      expect(result.meta.leapDayOmitted).toBe(
        year === 2008 || year === 2012 || year === 2016 || year === 2020
      );
    }
  });

  it("classifies WD / SA / SU with the shared BDEW Europe/Berlin helper", () => {
    const days = buildEvModelDays(2018);
    for (const day of days) {
      expect(day.dayType).toBe(
        classifyBdewDayTypeEuropeBerlin(2018, day.month, day.day)
      );
    }
    expect(classifyBdewDayTypeEuropeBerlin(2018, 1, 1)).toBe("WD");
    expect(classifyBdewDayTypeEuropeBerlin(2018, 1, 6)).toBe("SA");
    expect(classifyBdewDayTypeEuropeBerlin(2018, 1, 7)).toBe("SU");
    const counts = countEvDayTypes(days);
    expect(counts.WD + counts.SA + counts.SU).toBe(365);
    expect(counts.SA).toBeGreaterThan(0);
    expect(counts.SU).toBeGreaterThan(0);
  });

  it("rebuilds independently so different calendars change EV timing", () => {
    const a = createEvProfile(commuterInput({ year: 2006 }));
    const b = createEvProfile(commuterInput({ year: 2007 }));
    expect(a.profile).not.toEqual(b.profile);
    expect(a.meta.dayCounts).not.toEqual(b.meta.dayCounts);
    expect(a.meta.annualDrivingDemandKwh).toBe(b.meta.annualDrivingDemandKwh);
  });
});
