/**
 * Year-specific BDEW H0 assembly: templates (month × WD/SA/SU) from reference
 * {@link BDEW_H0}, then rebuild 8760h for any target year (PVGIS-aligned:
 * Feb 29 skipped in leap years).
 */

import { BDEW_H0 } from "./bdew_h0";

export type BdewDayType = "WD" | "SA" | "SU";

const HOURS_PER_YEAR = 8760;

/** Calendar year encoded in {@link BDEW_H0} / bdew_h0_hourly_nonleap.csv timestamps. */
export const BDEW_H0_REFERENCE_CALENDAR_YEAR = 2025;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Civil days in the 8760h series: full year minus Feb 29 when leap
 * (matches PVGIS non-leap normalization).
 */
export function* iterateBdewProfileDays(
  year: number
): Generator<{ month: number; day: number }> {
  const leap = isLeapYear(year);
  const monthLengths = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= monthLengths[m]; d++) {
      if (leap && m === 1 && d === 29) continue;
      yield { month: m + 1, day: d };
    }
  }
}

function templateKey(month: number, dayType: BdewDayType): string {
  return `${month}:${dayType}`;
}

function classifyDayTypeEuropeBerlin(
  year: number,
  month: number,
  day: number
): BdewDayType {
  const ms = Date.UTC(year, month - 1, day, 12, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (wd === "Sat") return "SA";
  if (wd === "Sun") return "SU";
  return "WD";
}

function assertClose(a: number, b: number, context: string): void {
  if (Math.abs(a - b) > 1e-9) {
    throw new Error(`BDEW H0 template inconsistency (${context}): ${a} vs ${b}`);
  }
}

function buildTemplateMap(): Map<string, readonly number[]> {
  if (BDEW_H0.length !== HOURS_PER_YEAR) {
    throw new Error(
      `BDEW_H0 length ${BDEW_H0.length}, expected ${HOURS_PER_YEAR}`
    );
  }
  const map = new Map<string, number[]>();
  let offset = 0;
  const refYear = BDEW_H0_REFERENCE_CALENDAR_YEAR;
  for (const { month, day } of iterateBdewProfileDays(refYear)) {
    const dayType = classifyDayTypeEuropeBerlin(refYear, month, day);
    const key = templateKey(month, dayType);
    const slice = BDEW_H0.slice(offset, offset + 24);
    if (slice.length !== 24) {
      throw new Error("BDEW_H0 slice length not 24");
    }
    const existing = map.get(key);
    if (!existing) {
      map.set(key, [...slice]);
    } else {
      for (let i = 0; i < 24; i++) {
        assertClose(existing[i], slice[i], key);
      }
    }
    offset += 24;
  }
  if (offset !== HOURS_PER_YEAR) {
    throw new Error(`BDEW template walk ended at offset ${offset}`);
  }
  return map;
}

const BDEW_H0_TEMPLATES_KWH_REF = buildTemplateMap();

/** Raw hourly weights (sum ≈ 1 GWh reference) for the given calendar year. */
export function buildBdewH0WeightsForYear(year: number): number[] {
  if (!Number.isInteger(year)) {
    throw new Error("year must be an integer");
  }
  const weights: number[] = [];
  for (const { month, day } of iterateBdewProfileDays(year)) {
    const dayType = classifyDayTypeEuropeBerlin(year, month, day);
    const key = templateKey(month, dayType);
    const block = BDEW_H0_TEMPLATES_KWH_REF.get(key);
    if (!block) {
      throw new Error(`Missing BDEW H0 template for key "${key}"`);
    }
    weights.push(...block);
  }
  if (weights.length !== HOURS_PER_YEAR) {
    throw new Error(`Expected ${HOURS_PER_YEAR} weights, got ${weights.length}`);
  }
  return weights;
}
