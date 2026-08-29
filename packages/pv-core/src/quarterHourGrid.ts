/**
 * Shared 15-minute time-grid constants and energy-conserving hourly →
 * quarter-hour expansion.
 *
 * Production SpeicherGrenze uses 35040 steps at Δt = 0.25 h.
 * Hourly 8760 / Δt = 1 remains supported for regression.
 *
 * PVGIS remains an hourly source. Expansion only splits already-aligned
 * hourly energy; it does not call a 15-min PVGIS API or interpolate irradiance.
 */

/** Duration of one quarter-hour step in minutes. */
export const TIME_STEP_MINUTES_15 = 15;

/** Duration of one quarter-hour step in hours (Δt). */
export const TIME_STEP_HOURS_15 = 0.25;

/** Quarter-hour steps in one clock hour. */
export const STEPS_PER_HOUR_15 = 4;

/** Quarter-hour steps in one civil day. */
export const STEPS_PER_DAY_15 = 96;

/**
 * Quarter-hour steps in the fixed non-leap year grid
 * (365 × {@link STEPS_PER_DAY_15}).
 */
export const STEPS_PER_NON_LEAP_YEAR_15 = 35040;

/** Fixed non-leap hourly grid (PVGIS after Berlin alignment). */
export const STEPS_PER_NON_LEAP_YEAR_HOURLY = 8760;

/**
 * Year length required by the physical kernel for a supported timestep.
 * Only 1 h (8760) and 0.25 h (35040) are allowed.
 */
export function expectedStepsPerYearForTimeStepHours(
  timeStepHours: number
): number {
  if (timeStepHours === 1) return STEPS_PER_NON_LEAP_YEAR_HOURLY;
  if (timeStepHours === TIME_STEP_HOURS_15) return STEPS_PER_NON_LEAP_YEAR_15;
  throw new Error(
    `unsupported timeStepHours ${timeStepHours} (supported: 1 and ${TIME_STEP_HOURS_15})`
  );
}

/**
 * Split each hourly energy value E into four equal quarter-hours [E/4, E/4, E/4, E/4].
 *
 * Conserves energy of every input hour and of the whole series.
 * Length: `hourlyKwh.length * STEPS_PER_HOUR_15`.
 * Does not convert power; input and output are both energy (kWh).
 */
export function expandHourlyEnergyToQuarterHours(
  hourlyKwh: readonly number[]
): number[] {
  const nHours = hourlyKwh.length;
  if (nHours === 0) {
    throw new Error("expandHourlyEnergyToQuarterHours: hourly series is empty");
  }
  const out = new Array<number>(nHours * STEPS_PER_HOUR_15);
  for (let h = 0; h < nHours; h++) {
    const e = hourlyKwh[h];
    if (!Number.isFinite(e) || e < 0) {
      throw new Error(
        `expandHourlyEnergyToQuarterHours: invalid energy at hour ${h}`
      );
    }
    const q = e / STEPS_PER_HOUR_15;
    const base = h * STEPS_PER_HOUR_15;
    out[base] = q;
    out[base + 1] = q;
    out[base + 2] = q;
    out[base + 3] = q;
  }
  return out;
}

/**
 * Expand each weather-year hourly series independently.
 * Preferred multi-roof order: sum surfaces hourly, then expand once.
 */
export function expandHourlyEnergyToQuarterHoursByYear(
  hourlyByYear: Record<number, readonly number[]>
): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  for (const yearStr of Object.keys(hourlyByYear)) {
    const year = Number(yearStr);
    out[year] = expandHourlyEnergyToQuarterHours(hourlyByYear[year]);
  }
  return out;
}
