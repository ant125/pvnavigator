/**
 * BDEW household load profiles.
 * Pure module: no fs / filesystem access. Safe in serverless environments.
 *
 * Production SpeicherGrenze still uses the hourly H0-named series (8760h)
 * via {@link createUserLoadProfileForYear}. The native source workbook is
 * BDEW H25 at 15-minute resolution; the 15-min API is prepared in Phase 4B
 * and is not switched on for production yet.
 *
 * Do not import in client components – use @bdew-profile/loader/chart for UI.
 */

import { BDEW_H0 } from "./bdew_h0";
import { buildBdewH0WeightsForYear } from "./bdewH0YearProfile";

export type HourlyRow = {
  kWh: number;
};

export type BdewProfileKey = "H0";

const BDEW_REFERENCE_GWH = 1_000_000;

/**
 * Load raw hourly weights from BDEW profile (8760h).
 * Values are for 1 GWh reference (sum ≈ 1e6).
 */
export function loadBDEWProfileHourlies(
  profileKey: BdewProfileKey = "H0"
): number[] {
  if (profileKey !== "H0") {
    throw new Error(`Unsupported BDEW profile: ${profileKey}`);
  }

  if (BDEW_H0.length !== 8760) {
    throw new Error(`BDEW H0 profile length mismatch: ${BDEW_H0.length}`);
  }

  return BDEW_H0;
}

/**
 * Scale hourly weights to annual consumption.
 * hourlyWeights: raw from loadBDEWProfileHourlies (sum ≈ 1e6 for 1 GWh)
 */
export function scaleToAnnualKWh(
  hourlyWeights: number[],
  annualKWh: number
): number[] {
  const scaleFactor = annualKWh / BDEW_REFERENCE_GWH;
  return hourlyWeights.map((w) => w * scaleFactor);
}

export function loadBDEWH0Profile(): HourlyRow[] {
  const weights = loadBDEWProfileHourlies("H0");
  return weights.map((kWh) => ({ kWh }));
}

export function createUserLoadProfile(annualConsumptionKWh: number): number[] {
  const weights = loadBDEWProfileHourlies("H0");
  return scaleToAnnualKWh(weights, annualConsumptionKWh);
}

/**
 * BDEW H0 hourly load (8760h) scaled to `annualKWh`, using the same (month × day-type)
 * templates as the static profile but with weekday/Sat/Sun layout for `year`
 * (`Europe/Berlin`). Leap years omit Feb 29 to match PVGIS 8760h series.
 *
 * Scaling uses the **actual** sum of the year-remapped weights (not the fixed
 * 1 GWh reference), so `sum(result) === annualKWh` within floating-point error.
 */
export function createUserLoadProfileForYear(
  annualKWh: number,
  year: number
): number[] {
  if (!Number.isFinite(annualKWh) || annualKWh <= 0) {
    throw new Error("annualKWh must be a positive finite number");
  }
  const weights = buildBdewH0WeightsForYear(year);
  let actualWeightSum = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`BDEW weight at index ${i} is invalid`);
    }
    actualWeightSum += w;
  }
  if (!(actualWeightSum > 0) || !Number.isFinite(actualWeightSum)) {
    throw new Error("BDEW weight sum must be a positive finite number");
  }
  const scaleFactor = annualKWh / actualWeightSum;
  return weights.map((w) => w * scaleFactor);
}

export { BDEW_H0_REFERENCE_CALENDAR_YEAR } from "./bdewH0YearProfile";
export {
  iterateBdewProfileDays,
  classifyBdewDayTypeEuropeBerlin,
  isLeapYear,
} from "./bdewCalendar";
export type { BdewDayType } from "./bdewCalendar";

export {
  createUserLoadProfile15MinForYear,
  buildBdewH25QuarterHourWeightsForYear,
  aggregateQuarterHoursToHourly,
  h25SourceDayTypeFromCalendar,
  BDEW_H25_SOURCE,
  BDEW_H25_SLOT_LABELS,
  BDEW_H25_SLOTS_PER_DAY,
  BDEW_H25_STEPS_PER_NON_LEAP_YEAR,
  BDEW_H25_REFERENCE_CALENDAR_YEAR,
  BDEW_H25_REFERENCE_ANNUAL_KWH,
  BDEW_H25_TEMPLATES,
} from "./bdewH25QuarterHour";
export type { BdewH25SourceDayType } from "./bdewH25QuarterHour";
