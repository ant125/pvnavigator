/**
 * Year-specific BDEW H0 assembly: templates (month × WD/SA/SU) from reference
 * {@link BDEW_H0}, then rebuild 8760h for any target year (PVGIS-aligned:
 * Feb 29 skipped in leap years).
 */

import {
  classifyBdewDayTypeEuropeBerlin,
  iterateBdewProfileDays,
  type BdewDayType,
} from "./bdewCalendar";
import { BDEW_H0 } from "./bdew_h0";

export type { BdewDayType };
export {
  classifyBdewDayTypeEuropeBerlin,
  iterateBdewProfileDays,
  isLeapYear,
} from "./bdewCalendar";

const HOURS_PER_YEAR = 8760;

/** Calendar year encoded in {@link BDEW_H0} / bdew_h0_hourly_nonleap.csv timestamps. */
export const BDEW_H0_REFERENCE_CALENDAR_YEAR = 2025;

function templateKey(month: number, dayType: BdewDayType): string {
  return `${month}:${dayType}`;
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
    const dayType = classifyBdewDayTypeEuropeBerlin(refYear, month, day);
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
    const dayType = classifyBdewDayTypeEuropeBerlin(year, month, day);
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
