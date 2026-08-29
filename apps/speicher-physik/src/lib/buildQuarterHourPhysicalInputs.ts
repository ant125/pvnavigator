/**
 * Phase 4C — alternate 15-minute physical input pipeline for one weather year.
 *
 * Not wired to calculateSpeicherResult / runPhysicalKernel production.
 * Production still uses 8760 arrays and timeStepHours = 1.
 *
 * Sources:
 * - household: native BDEW H25 15-min (`createUserLoadProfile15MinForYear`)
 * - PVGIS: remains hourly; after Berlin 8760 alignment each hour E is split
 *   uniformly into [E/4, E/4, E/4, E/4]
 * - Wärmepumpe: same synthetic seasonal multipliers, native 96 slots/day
 *
 * All output arrays have length 35040 (non-leap year).
 */

import { createUserLoadProfile15MinForYear } from "../../../../packages/bdew-profile";
import {
  STEPS_PER_NON_LEAP_YEAR_15,
  TIME_STEP_HOURS_15,
} from "../../../../packages/pv-core";
import { expandAlignedPvgisHourlyToQuarterHours } from "../../../../packages/pvgis-adapter";
import { createHeatPumpComponent15Min } from "@/load/heatpump";
import { mergeLoadProfiles, type LoadComponent } from "@/load/merge";

export type QuarterHourPhysicalInputs = {
  year: number;
  timeStepHours: typeof TIME_STEP_HOURS_15;
  stepsPerYear: typeof STEPS_PER_NON_LEAP_YEAR_15;
  householdLoadKwh: number[];
  heatPumpLoadKwh: number[] | null;
  mergedLoadKwh: number[];
  pvKwh: number[];
};

export function buildQuarterHourPhysicalInputsForYear(params: {
  year: number;
  annualConsumptionKWh: number;
  /** Already aligned PVGIS hourly kWh (8760). */
  hourlyPvKwh: readonly number[];
  heatPumpEnabled?: boolean;
  heatPumpConsumptionKWh?: number;
}): QuarterHourPhysicalInputs {
  const householdLoadKwh = createUserLoadProfile15MinForYear(
    params.annualConsumptionKWh,
    params.year
  );
  const pvKwh = expandAlignedPvgisHourlyToQuarterHours(params.hourlyPvKwh);

  const components: LoadComponent[] = [
    {
      name: "house",
      yearlyConsumption: params.annualConsumptionKWh,
      profile: householdLoadKwh,
    },
  ];

  let heatPumpLoadKwh: number[] | null = null;
  if (
    params.heatPumpEnabled === true &&
    typeof params.heatPumpConsumptionKWh === "number" &&
    params.heatPumpConsumptionKWh > 0
  ) {
    const hp = createHeatPumpComponent15Min(params.heatPumpConsumptionKWh);
    heatPumpLoadKwh = hp.profile;
    components.push(hp);
  }

  const mergedLoadKwh = mergeLoadProfiles(components);

  if (
    householdLoadKwh.length !== STEPS_PER_NON_LEAP_YEAR_15 ||
    mergedLoadKwh.length !== STEPS_PER_NON_LEAP_YEAR_15 ||
    pvKwh.length !== STEPS_PER_NON_LEAP_YEAR_15 ||
    (heatPumpLoadKwh !== null &&
      heatPumpLoadKwh.length !== STEPS_PER_NON_LEAP_YEAR_15)
  ) {
    throw new Error(
      `buildQuarterHourPhysicalInputsForYear: expected ${STEPS_PER_NON_LEAP_YEAR_15} steps`
    );
  }

  return {
    year: params.year,
    timeStepHours: TIME_STEP_HOURS_15,
    stepsPerYear: STEPS_PER_NON_LEAP_YEAR_15,
    householdLoadKwh,
    heatPumpLoadKwh,
    mergedLoadKwh,
    pvKwh,
  };
}
