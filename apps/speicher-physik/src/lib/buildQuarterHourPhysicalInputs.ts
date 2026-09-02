/**
 * Phase 4C — alternate 15-minute physical input pipeline for one weather year.
 *
 * Used by production via the same 15-min load/PV helpers in
 * calculateSpeicherResult / simulateMultiYearSpeicherGrenz.
 * Hourly helpers remain for regression.
 *
 * Sources:
 * - household: native BDEW H25 15-min (`createUserLoadProfile15MinForYear`)
 * - PVGIS: remains hourly; after Berlin 8760 alignment each hour E is split
 *   uniformly into [E/4, E/4, E/4, E/4]
 * - Wärmepumpe: `@heatpump-profile/loader` Luft/Wasser and Wasser/Wasser
 *   prototypes, scaled to user kWh. Legacy inputs default to unknown +
 *   heating+DHW.
 *
 * All output arrays have length 35040 (non-leap year).
 */

import { createUserLoadProfile15MinForYear } from "../../../../packages/bdew-profile";
import {
  STEPS_PER_NON_LEAP_YEAR_15,
  TIME_STEP_HOURS_15,
} from "../../../../packages/pv-core";
import { expandAlignedPvgisHourlyToQuarterHours } from "../../../../packages/pvgis-adapter";
import { mergeHouseholdWithHeatPump, type LoadComponent } from "@/load/merge";
import {
  buildHeatPumpLoadComponent,
  type HeatPumpCalculationMeta,
  type HeatPumpDhwService,
  type HeatPumpTechnologyProduction,
} from "@/load/resolveHeatPumpLoadComponent";

export type QuarterHourPhysicalInputs = {
  year: number;
  timeStepHours: typeof TIME_STEP_HOURS_15;
  stepsPerYear: typeof STEPS_PER_NON_LEAP_YEAR_15;
  householdLoadKwh: number[];
  heatPumpLoadKwh: number[] | null;
  mergedLoadKwh: number[];
  pvKwh: number[];
  heatPumpMeta: HeatPumpCalculationMeta | null;
};

export function buildQuarterHourPhysicalInputsForYear(params: {
  year: number;
  annualConsumptionKWh: number;
  /** Already aligned PVGIS hourly kWh (8760). */
  hourlyPvKwh: readonly number[];
  heatPumpEnabled?: boolean;
  heatPumpConsumptionKWh?: number;
  heatPumpTechnology?: HeatPumpTechnologyProduction;
  heatPumpDhwService?: HeatPumpDhwService;
}): QuarterHourPhysicalInputs {
  const householdLoadKwh = createUserLoadProfile15MinForYear(
    params.annualConsumptionKWh,
    params.year
  );
  const pvKwh = expandAlignedPvgisHourlyToQuarterHours(params.hourlyPvKwh);

  let heatPump: LoadComponent | null = null;
  let heatPumpMeta: HeatPumpCalculationMeta | null = null;
  if (
    params.heatPumpEnabled === true &&
    typeof params.heatPumpConsumptionKWh === "number" &&
    params.heatPumpConsumptionKWh > 0
  ) {
    const resolved = buildHeatPumpLoadComponent({
      annualElectricalKwh: params.heatPumpConsumptionKWh,
      year: params.year,
      technology: params.heatPumpTechnology,
      dhwService: params.heatPumpDhwService,
    });
    heatPump = resolved.component;
    heatPumpMeta = resolved.meta;
  }

  const heatPumpLoadKwh = heatPump?.profile ?? null;
  const mergedLoadKwh = mergeHouseholdWithHeatPump({
    householdProfile: householdLoadKwh,
    householdAnnualKwh: params.annualConsumptionKWh,
    heatPump,
  });

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
    heatPumpMeta,
  };
}
