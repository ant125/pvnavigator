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
  evWindowUnavailable,
} from "./helpers";

describe("home windows", () => {
  it("materializes same-day, overnight, and empty encodings", () => {
    const sameDay = materializeDayMask(
      evWindowBounded(evClock(10, 0), evClock(16, 0))
    );
    expect(sameDay.slice(0, 40).every((v) => !v)).toBe(true);
    expect(sameDay.slice(40, 64).every((v) => v)).toBe(true);
    expect(sameDay.slice(64).every((v) => !v)).toBe(true);
    expect(eventBoundaryFromMask(sameDay)).toBe(0);

    const overnight = materializeDayMask(
      evWindowBounded(evClock(17, 30), evClock(7, 0))
    );
    expect(overnight.slice(0, 28).every((v) => v)).toBe(true);
    expect(overnight.slice(28, 70).every((v) => !v)).toBe(true);
    expect(overnight.slice(70).every((v) => v)).toBe(true);
    expect(eventBoundaryFromMask(overnight)).toBe(28);

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

  it("rejects a fullDay encoding", () => {
    expect(() =>
      materializeDayMask({ kind: "fullDay" } as never)
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

  it("does not charge at Saturday midnight when the window is 10:00–16:00", () => {
    const result = createEvProfile(
      commuterInput({
        year: 2025,
        homeWindow: {
          WD: evWindowBounded(evClock(17, 30), evClock(7, 0)),
          SA: evWindowBounded(evClock(10, 0), evClock(16, 0)),
          SU: evWindowBounded(evClock(10, 0), evClock(16, 0)),
        },
      })
    );
    const days = buildEvModelDays(2025);
    const saturday = days.find((d) => d.month === 1 && d.day === 11);
    expect(saturday?.dayType).toBe("SA");
    const offset = saturday!.dayIndex * EV_SLOTS_PER_DAY;
    const midnightSlots = result.profile.slice(offset, offset + 40);
    expect(midnightSlots.every((value) => value === 0)).toBe(true);
    const windowSlots = result.profile.slice(offset + 40, offset + 64);
    expect(windowSlots.some((value) => value > 0)).toBe(true);
    expect(result.profile.slice(offset + 64, offset + 96).every((v) => v === 0)).toBe(
      true
    );
  });
});
