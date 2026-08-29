/**
 * Post-alignment PVGIS hourly → quarter-hour energy.
 *
 * PVGIS seriescalc stays hourly. DST / leap / year-boundary alignment is
 * unchanged and must already have produced 8760 hourly values.
 * This layer only splits each hour's energy uniformly into four
 * quarter-hours. It is not a 15-min PVGIS API and is not used by production.
 *
 * Multi-roof: sum surfaces on the hourly grid, then expand once
 * (linear, lower memory than expand-each-then-sum).
 */

import {
  STEPS_PER_NON_LEAP_YEAR_15,
  expandHourlyEnergyToQuarterHours,
  expandHourlyEnergyToQuarterHoursByYear,
} from "../../pv-core/src/quarterHourGrid";

/** Same as {@link HOURS_PER_NON_LEAP_YEAR}; local copy avoids a cycle with index.ts. */
const ALIGNED_HOURS = 8760;

export {
  STEPS_PER_DAY_15,
  STEPS_PER_HOUR_15,
  STEPS_PER_NON_LEAP_YEAR_15,
  TIME_STEP_HOURS_15,
  TIME_STEP_MINUTES_15,
} from "../../pv-core/src/quarterHourGrid";

/**
 * Expand an already-aligned PVGIS 8760 hourly kWh series to 35040 quarter-hours.
 */
export function expandAlignedPvgisHourlyToQuarterHours(
  hourlyKwh: readonly number[]
): number[] {
  if (hourlyKwh.length !== ALIGNED_HOURS) {
    throw new Error(
      `expandAlignedPvgisHourlyToQuarterHours: expected ${ALIGNED_HOURS} hourly values, got ${hourlyKwh.length}`
    );
  }
  const qh = expandHourlyEnergyToQuarterHours(hourlyKwh);
  if (qh.length !== STEPS_PER_NON_LEAP_YEAR_15) {
    throw new Error(
      `expandAlignedPvgisHourlyToQuarterHours: expected ${STEPS_PER_NON_LEAP_YEAR_15} quarter-hours, got ${qh.length}`
    );
  }
  return qh;
}

/**
 * Expand each weather-year aligned hourly PV series (8760) to 35040.
 * Call after combining roof surfaces on the hourly grid.
 */
export function expandAlignedPvgisHourlyByYear(
  hourlyByYear: Record<number, readonly number[]>
): Record<number, number[]> {
  for (const yearStr of Object.keys(hourlyByYear)) {
    const hourly = hourlyByYear[Number(yearStr)];
    if (hourly.length !== ALIGNED_HOURS) {
      throw new Error(
        `expandAlignedPvgisHourlyByYear: year ${yearStr} expected ${ALIGNED_HOURS} hours, got ${hourly.length}`
      );
    }
  }
  return expandHourlyEnergyToQuarterHoursByYear(hourlyByYear);
}
