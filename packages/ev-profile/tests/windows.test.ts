import { describe, expect, it } from "vitest";
import { createEvProfile, EvProfileError, EV_SLOTS_PER_DAY } from "../src/index";
import { buildEvModelDays } from "../src/calendar";
import {
  eventBoundaryFromMask,
  materializeDayMask,
  materializeHomeAvailability,
} from "../src/windows";
import {
  commuterInput,
  evClock,
  evWindowBounded,
  evWindowFullDay,
  evWindowUnavailable,
} from "./helpers";

describe("home windows", () => {
  it("materializes same-day, overnight, full-day, and empty encodings", () => {
    const sameDay = materializeDayMask(
      evWindowBounded(evClock(18, 0), evClock(22, 0))
    );
    expect(sameDay.slice(0, 72).every((v) => !v)).toBe(true);
    expect(sameDay.slice(72, 88).every((v) => v)).toBe(true);
    expect(sameDay.slice(88).every((v) => !v)).toBe(true);
    expect(eventBoundaryFromMask(sameDay)).toBe(0);

    const overnight = materializeDayMask(
      evWindowBounded(evClock(18, 0), evClock(8, 0))
    );
    expect(overnight.slice(0, 32).every((v) => v)).toBe(true);
    expect(overnight.slice(32, 72).every((v) => !v)).toBe(true);
    expect(overnight.slice(72).every((v) => v)).toBe(true);
    expect(eventBoundaryFromMask(overnight)).toBe(32);

    const full = materializeDayMask(evWindowFullDay());
    expect(full.every((v) => v)).toBe(true);
    expect(eventBoundaryFromMask(full)).toBe(0);

    const empty = materializeDayMask(evWindowUnavailable());
    expect(empty.every((v) => !v)).toBe(true);
    expect(eventBoundaryFromMask(empty)).toBe(0);
  });

  it("rejects start === end instead of inferring 24 hours", () => {
    expect(() =>
      materializeDayMask(evWindowBounded(evClock(18, 0), evClock(18, 0)))
    ).toThrow(EvProfileError);
    expect(() =>
      materializeDayMask(evWindowBounded(evClock(0, 0), evClock(0, 0)))
    ).toThrow(EvProfileError);
  });

  it("does not leak a Friday overnight window into Saturday morning", () => {
    const days = buildEvModelDays(2018);
    const friday = days.find((d) => d.month === 1 && d.day === 5);
    const saturday = days.find((d) => d.month === 1 && d.day === 6);
    expect(friday?.dayType).toBe("WD");
    expect(saturday?.dayType).toBe("SA");

    const availability = materializeHomeAvailability(days, {
      WD: evWindowBounded(evClock(18, 0), evClock(8, 0)),
      SA: evWindowUnavailable(),
      SU: evWindowUnavailable(),
    });
    const fridayOffset = friday!.dayIndex * EV_SLOTS_PER_DAY;
    const saturdayOffset = saturday!.dayIndex * EV_SLOTS_PER_DAY;
    expect(availability.mask.slice(fridayOffset, fridayOffset + 32).every(Boolean)).toBe(
      true
    );
    expect(
      availability.mask.slice(saturdayOffset, saturdayOffset + 32).every((v) => !v)
    ).toBe(true);

    const result = createEvProfile(
      commuterInput({
        homeWindow: {
          WD: evWindowBounded(evClock(18, 0), evClock(8, 0)),
          SA: evWindowUnavailable(),
          SU: evWindowUnavailable(),
        },
        workplace: { enabled: false },
      })
    );
    expect(
      result.profile.slice(saturdayOffset, saturdayOffset + 32).every((v) => v === 0)
    ).toBe(true);
  });
});
