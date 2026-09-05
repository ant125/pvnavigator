import { EV_SLOTS_PER_DAY, EV_STEPS_PER_NON_LEAP_YEAR } from "./constants";
import { invalidInput } from "./errors";
import type {
  EvAvailability,
  EvClockTime,
  EvHomeWindow,
  EvHomeWindows,
  EvModelDay,
} from "./types";

export function evClock(hour: number, minute: number): EvClockTime {
  return { hour, minute };
}

export function evWindowUnavailable(): EvHomeWindow {
  return { kind: "unavailable" };
}

export function evWindowFullDay(): EvHomeWindow {
  return { kind: "fullDay" };
}

export function evWindowBounded(
  start: EvClockTime,
  end: EvClockTime
): EvHomeWindow {
  return { kind: "bounded", start, end };
}

export function clockToSlot(time: EvClockTime, role: "start" | "end"): number {
  const { hour, minute } = time;
  if (hour === 24 && minute === 0) {
    if (role === "start") {
      throw invalidInput(
        "INVALID_WINDOW",
        "24:00 is valid only as an exclusive window end",
        { time, role }
      );
    }
    return EV_SLOTS_PER_DAY;
  }
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    (minute !== 0 && minute !== 15 && minute !== 30 && minute !== 45)
  ) {
    throw invalidInput(
      "INVALID_WINDOW",
      "window times must lie on the 15-minute grid (hour 0–23, or 24:00 as end)",
      { time, role }
    );
  }
  return hour * 4 + minute / 15;
}

export function materializeDayMask(window: EvHomeWindow): boolean[] {
  const mask = new Array<boolean>(EV_SLOTS_PER_DAY).fill(false);
  if (window.kind === "unavailable") {
    return mask;
  }
  if (window.kind === "fullDay") {
    return mask.fill(true);
  }
  if (window.kind !== "bounded") {
    throw invalidInput("INVALID_WINDOW", "unknown home-window kind", {
      window,
    });
  }
  const startSlot = clockToSlot(window.start, "start");
  const endSlot = clockToSlot(window.end, "end");
  if (startSlot === endSlot) {
    throw invalidInput(
      "INVALID_WINDOW",
      "start === end is not 24-hour availability; use kind: \"fullDay\" or kind: \"unavailable\"",
      { start: window.start, end: window.end }
    );
  }
  if (startSlot < endSlot) {
    for (let i = startSlot; i < endSlot; i++) mask[i] = true;
  } else {
    for (let i = startSlot; i < EV_SLOTS_PER_DAY; i++) mask[i] = true;
    for (let i = 0; i < endSlot; i++) mask[i] = true;
  }
  return mask;
}

export function eventBoundaryFromMask(dayMask: readonly boolean[]): number {
  for (let slot = 0; slot < dayMask.length; slot++) {
    if (!dayMask[slot]) return slot;
  }
  return 0;
}

export function materializeHomeAvailability(
  days: readonly EvModelDay[],
  windows: EvHomeWindows
): EvAvailability {
  const mask = new Array<boolean>(EV_STEPS_PER_NON_LEAP_YEAR).fill(false);
  const eventBoundarySlot = new Array<number>(days.length);
  const dayMasks: Record<"WD" | "SA" | "SU", boolean[]> = {
    WD: materializeDayMask(windows.WD),
    SA: materializeDayMask(windows.SA),
    SU: materializeDayMask(windows.SU),
  };

  for (const day of days) {
    const dayMask = dayMasks[day.dayType];
    eventBoundarySlot[day.dayIndex] = eventBoundaryFromMask(dayMask);
    const offset = day.dayIndex * EV_SLOTS_PER_DAY;
    for (let slot = 0; slot < EV_SLOTS_PER_DAY; slot++) {
      mask[offset + slot] = dayMask[slot];
    }
  }
  return { mask, eventBoundarySlot };
}

export function countAvailableSlots(mask: readonly boolean[]): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) n += 1;
  }
  return n;
}
