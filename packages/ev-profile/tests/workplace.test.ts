import { describe, expect, it } from "vitest";
import {
  createEvProfile,
  EvProfileError,
  workplaceIndex,
} from "../src/index";
import { buildEvModelDays } from "../src/calendar";
import { placeWorkplaceEvents } from "../src/workplace";
import { commuterInput, evWindowUnavailable, sum } from "./helpers";

describe("workplace events", () => {
  it("places the exact midpoint-index formula deterministically", () => {
    expect(workplaceIndex(0, 20, 4)).toBe(2);
    expect(workplaceIndex(1, 20, 4)).toBe(7);
    expect(workplaceIndex(2, 20, 4)).toBe(12);
    expect(workplaceIndex(3, 20, 4)).toBe(17);
    expect(workplaceIndex(0, 20, 1)).toBe(10);
    expect(workplaceIndex(0, 21, 21)).toBe(0);
    expect(workplaceIndex(20, 21, 21)).toBe(20);
  });

  it("creates n events per month with exact monthly energy", () => {
    const days = buildEvModelDays(2018);
    const events = placeWorkplaceEvents(days, {
      enabled: true,
      kwhPerMonth: 80,
      chargingDaysPerMonth: 8,
    });
    expect(events).toHaveLength(12 * 8);
    for (let month = 1; month <= 12; month++) {
      const monthly = events.filter((event) => event.month === month);
      expect(monthly).toHaveLength(8);
      expect(Math.abs(sum(monthly.map((e) => e.offerKwh)) - 80)).toBeLessThan(
        1e-12
      );
      const eligible = days.filter((d) => d.month === month && d.dayType === "WD");
      for (let k = 0; k < 8; k++) {
        expect(monthly[k].dayIndex).toBe(
          eligible[workplaceIndex(k, eligible.length, 8)].dayIndex
        );
      }
    }
    const again = placeWorkplaceEvents(days, {
      enabled: true,
      kwhPerMonth: 80,
      chargingDaysPerMonth: 8,
    });
    expect(again).toEqual(events);
  });

  it("rejects n > W without clamping", () => {
    expect(() =>
      placeWorkplaceEvents(buildEvModelDays(2018), {
        enabled: true,
        kwhPerMonth: 10,
        chargingDaysPerMonth: 21,
      })
    ).toThrow(EvProfileError);
    try {
      placeWorkplaceEvents(buildEvModelDays(2018), {
        enabled: true,
        kwhPerMonth: 10,
        chargingDaysPerMonth: 21,
      });
    } catch (error) {
      expect((error as EvProfileError).code).toBe(
        "WORKPLACE_DAYS_EXCEED_WEEKDAYS"
      );
    }
  });

  it("never writes workplace energy into the returned home profile", () => {
    const result = createEvProfile(
      commuterInput({
        annualKm: 12000,
        typicalDailyKm: { WD: 40, SA: 20, SU: 10 },
        homeWindow: {
          WD: evWindowUnavailable(),
          SA: evWindowUnavailable(),
          SU: evWindowUnavailable(),
        },
        workplace: { enabled: true, kwhPerMonth: 200, chargingDaysPerMonth: 8 },
        usableBatteryCapacityKwh: 80,
      })
    );
    expect(sum(result.profile)).toBe(0);
    expect(result.meta.homeChargedKwh).toBe(0);
    expect(result.meta.workplaceDeclaredKwh).toBe(2400);
    expect(result.meta.workplaceAcceptedKwh).toBeGreaterThan(0);
    expect(result.profile.every((value) => value === 0)).toBe(true);
  });
});
