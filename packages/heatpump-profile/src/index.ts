/**
 * Heat-pump electrical class prototypes (15-minute, non-leap 35 040 steps).
 *
 * Pure module: no `fs`. Runtime never reads research zips or raw datasets.
 * Selection goes through the catalogue; scaling is uniform electrical energy
 * only. Not wired into SpeicherGrenze production yet.
 *
 * Do not import in client components.
 */

import { loadHeatPumpProfile } from "./loader";
import { resolveHeatPumpProfile } from "./resolver";
import { scaleUniformEnergy } from "./scale";
import type {
  CreateHeatPumpProfile15MinInput,
  HeatPumpProfile15MinResult,
} from "./types";
import {
  HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR,
  HEAT_PUMP_TIME_STEP_HOURS,
} from "./types";

export {
  HEAT_PUMP_CATALOGUE,
  getHeatPumpCatalogue,
  getHeatPumpCatalogueEntry,
} from "./catalogue";
export { loadHeatPumpProfile } from "./loader";
export { resolveHeatPumpProfile } from "./resolver";
export { scaleUniformEnergy } from "./scale";
export {
  HEAT_PUMP_ENVELOPE_SCHEMA_VERSION,
  HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR,
  HEAT_PUMP_TIME_STEP_HOURS,
} from "./types";
export type {
  CreateHeatPumpProfile15MinInput,
  HeatPumpCatalogueEntry,
  HeatPumpDhwService,
  HeatPumpFallback,
  HeatPumpProfile15MinResult,
  HeatPumpProfileEnvelope,
  HeatPumpProfileMeta,
  HeatPumpProfileQuality,
  HeatPumpTechnology,
  HeatPumpTechnologyInput,
  ResolvedHeatPumpProfile,
} from "./types";

/**
 * Build a 15-minute heat-pump electrical series scaled to user kWh.
 *
 * Shape is one measured prototype year, repeated every simulation year.
 * `year` only encodes the leap-day omit rule; weekdays are not remapped.
 */
export function createHeatPumpProfile15Min(
  input: CreateHeatPumpProfile15MinInput
): HeatPumpProfile15MinResult {
  const year = input.year;
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error("year must be an integer in 1900–2100");
  }

  const resolved = resolveHeatPumpProfile({
    technology: input.technology,
    dhwService: input.dhwService,
    profileId: input.profileId,
  });
  const envelope = loadHeatPumpProfile(resolved.entry);
  const { profile, scaleFactor } = scaleUniformEnergy(
    envelope.weights,
    input.annualElectricalKwh
  );

  if (profile.length !== HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR) {
    throw new Error(
      `heat-pump profile length ${profile.length}, expected ${HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR}`
    );
  }

  return {
    profile,
    meta: {
      resolvedProfile: resolved.entry,
      scaleFactor,
      fallback: resolved.fallback,
      methodologySourceId: resolved.entry.methodologySourceId,
      license: resolved.entry.license,
      measuredAnnualElectricalKwh: envelope.measuredAnnualElectricalKwh,
      year,
      leapDayOmitted: isLeapYear(year),
      calendarRemap: false,
      timeStepHours: HEAT_PUMP_TIME_STEP_HOURS,
      steps: HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR,
    },
  };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
