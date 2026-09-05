/**
 * BDEW H25 quarter-hour year assembly (Phase 4B).
 *
 * Native source is H25 at 96 slots/day. Calendar remap matches the current
 * hourly production path: Sunday → FT template, Saturday → SA, other days → WT.
 * Weekday public holidays are not remapped. Dynamisierung is not applied.
 *
 * Not used by SpeicherGrenze production yet (still 8760 hourly; Phase 4C
 * exposes this via buildQuarterHourPhysicalInputsForYear only).
 */

import {
  classifyBdewDayTypeEuropeBerlin,
  iterateBdewProfileDays,
  type BdewDayType,
} from "./bdewCalendar";
import {
  BDEW_H25_SLOTS_PER_DAY,
  BDEW_H25_STEPS_PER_NON_LEAP_YEAR,
  BDEW_H25_TEMPLATES,
  type BdewH25SourceDayType,
} from "./bdew_h25_quarter_hour";

export {
  BDEW_H25_REFERENCE_ANNUAL_KWH,
  BDEW_H25_REFERENCE_CALENDAR_YEAR,
  BDEW_H25_SLOT_LABELS,
  BDEW_H25_SLOTS_PER_DAY,
  BDEW_H25_SOURCE,
  BDEW_H25_STEPS_PER_NON_LEAP_YEAR,
  BDEW_H25_TEMPLATES,
} from "./bdew_h25_quarter_hour";
export type { BdewH25SourceDayType } from "./bdew_h25_quarter_hour";

/**
 * Map calendar WD/SA/SU onto H25 source columns.
 * Sunday uses FT (not a public-holiday calendar). Weekday holidays stay WT.
 */
export function h25SourceDayTypeFromCalendar(
  dayType: BdewDayType
): BdewH25SourceDayType {
  if (dayType === "SA") return "SA";
  if (dayType === "SU") return "FT";
  return "WT";
}

function templateFor(month: number, sourceType: BdewH25SourceDayType): readonly number[] {
  const monthTemplates = BDEW_H25_TEMPLATES[month];
  if (!monthTemplates) {
    throw new Error(`Missing BDEW H25 templates for month ${month}`);
  }
  const block = monthTemplates[sourceType];
  if (!block || block.length !== BDEW_H25_SLOTS_PER_DAY) {
    throw new Error(
      `Missing BDEW H25 template ${month}:${sourceType} (len ${block?.length})`
    );
  }
  return block;
}

/**
 * Raw H25 quarter-hour weights for `year` (35040 steps, Feb 29 skipped).
 * Sum ≈ 1e6 kWh on the 2025 reference calendar; other years differ slightly
 * with the weekday mix, same as the hourly remapper.
 */
export function buildBdewH25QuarterHourWeightsForYear(year: number): number[] {
  if (!Number.isInteger(year)) {
    throw new Error("year must be an integer");
  }
  const weights: number[] = [];
  for (const { month, day } of iterateBdewProfileDays(year)) {
    const calendarType = classifyBdewDayTypeEuropeBerlin(year, month, day);
    const sourceType = h25SourceDayTypeFromCalendar(calendarType);
    weights.push(...templateFor(month, sourceType));
  }
  if (weights.length !== BDEW_H25_STEPS_PER_NON_LEAP_YEAR) {
    throw new Error(
      `Expected ${BDEW_H25_STEPS_PER_NON_LEAP_YEAR} H25 weights, got ${weights.length}`
    );
  }
  return weights;
}

/**
 * H25 quarter-hour household load (35040 steps) scaled to `annualKWh`.
 *
 * Scaling uses the actual remapped-year sum (not a second 1 GWh factor),
 * so `sum(result) === annualKWh` within floating-point error.
 *
 * Not wired into SpeicherGrenze production (Phase 4C builder only).
 */
export function createUserLoadProfile15MinForYear(
  annualKWh: number,
  year: number
): number[] {
  if (!Number.isFinite(annualKWh) || annualKWh <= 0) {
    throw new Error("annualKWh must be a positive finite number");
  }
  const weights = buildBdewH25QuarterHourWeightsForYear(year);
  let actualWeightSum = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`BDEW H25 weight at index ${i} is invalid`);
    }
    actualWeightSum += w;
  }
  if (!(actualWeightSum > 0) || !Number.isFinite(actualWeightSum)) {
    throw new Error("BDEW H25 weight sum must be a positive finite number");
  }
  const scaleFactor = annualKWh / actualWeightSum;
  return weights.map((w) => w * scaleFactor);
}

/** Sum four consecutive quarter-hour kWh values into 8760 hourly kWh. */
export function aggregateQuarterHoursToHourly(quarterHourKwh: number[]): number[] {
  if (quarterHourKwh.length !== BDEW_H25_STEPS_PER_NON_LEAP_YEAR) {
    throw new Error(
      `Expected ${BDEW_H25_STEPS_PER_NON_LEAP_YEAR} quarter-hour values, got ${quarterHourKwh.length}`
    );
  }
  const hourly = new Array<number>(8760);
  for (let h = 0; h < 8760; h++) {
    const i = h * 4;
    hourly[h] =
      quarterHourKwh[i] +
      quarterHourKwh[i + 1] +
      quarterHourKwh[i + 2] +
      quarterHourKwh[i + 3];
  }
  return hourly;
}
