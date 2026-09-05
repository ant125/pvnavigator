import {
  classifyBdewDayTypeEuropeBerlin,
  isLeapYear,
  iterateBdewProfileDays,
} from "@bdew-profile/loader/calendar";
import { EV_SLOTS_PER_DAY, EV_STEPS_PER_NON_LEAP_YEAR } from "./constants";
import { invalidInput } from "./errors";
import type { EvDayCounts, EvModelDay } from "./types";

export { isLeapYear };

export function assertEvYear(year: number): void {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw invalidInput(
      "INVALID_YEAR",
      "year must be an integer in 1900–2100",
      { year }
    );
  }
}

/**
 * Modelled civil days for target year Y: 365 days, Feb 29 omitted,
 * WD/SA/SU from the shared BDEW Europe/Berlin classifier.
 */
export function buildEvModelDays(year: number): EvModelDay[] {
  assertEvYear(year);
  const days: EvModelDay[] = [];
  for (const { month, day } of iterateBdewProfileDays(year)) {
    days.push({
      year,
      month,
      day,
      dayType: classifyBdewDayTypeEuropeBerlin(year, month, day),
      dayIndex: days.length,
    });
  }
  if (days.length !== 365) {
    throw invalidInput(
      "INVALID_YEAR",
      `EV calendar must contain 365 modelled days, got ${days.length}`,
      { year, dayCount: days.length }
    );
  }
  return days;
}

export function countEvDayTypes(days: readonly EvModelDay[]): EvDayCounts {
  const counts: EvDayCounts = { WD: 0, SA: 0, SU: 0 };
  for (const day of days) {
    counts[day.dayType] += 1;
  }
  return counts;
}

export function evYearSlotCount(days: readonly EvModelDay[]): number {
  const steps = days.length * EV_SLOTS_PER_DAY;
  if (steps !== EV_STEPS_PER_NON_LEAP_YEAR) {
    throw invalidInput(
      "INVALID_YEAR",
      `EV year must have ${EV_STEPS_PER_NON_LEAP_YEAR} slots, got ${steps}`,
      { steps }
    );
  }
  return steps;
}
