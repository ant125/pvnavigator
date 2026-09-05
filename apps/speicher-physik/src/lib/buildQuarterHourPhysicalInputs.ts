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
 * - EV: `@ev-profile/loader` home-charging profile for this target year.
 *
 * All output arrays have length 35040 (non-leap year).
 */

import { createUserLoadProfile15MinForYear } from "../../../../packages/bdew-profile";
import {
  STEPS_PER_NON_LEAP_YEAR_15,
  TIME_STEP_HOURS_15,
} from "../../../../packages/pv-core";
import { expandAlignedPvgisHourlyToQuarterHours } from "../../../../packages/pvgis-adapter";
import {
  mergeHouseholdLoadComponents,
  type LoadComponent,
} from "@/load/merge";
import {
  buildHeatPumpLoadComponent,
  type HeatPumpCalculationMeta,
  type HeatPumpDhwService,
  type HeatPumpTechnologyProduction,
} from "@/load/resolveHeatPumpLoadComponent";
import {
  resolveEnabledEvConfig,
  resolveEvLoadComponentForYear,
  type EvCalculationInput,
  type EvProfileMeta,
} from "@/load/resolveEvLoadComponent";

export type QuarterHourPhysicalInputs = {
  year: number;
  timeStepHours: typeof TIME_STEP_HOURS_15;
  stepsPerYear: typeof STEPS_PER_NON_LEAP_YEAR_15;
  householdLoadKwh: number[];
  heatPumpLoadKwh: number[] | null;
  evLoadKwh: number[] | null;
  mergedLoadKwh: number[];
  pvKwh: number[];
  heatPumpMeta: HeatPumpCalculationMeta | null;
  evMeta: EvProfileMeta | null;
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
  ev?: EvCalculationInput;
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

  let ev: LoadComponent | null = null;
  let evMeta: EvProfileMeta | null = null;
  const evConfig = resolveEnabledEvConfig(params.ev);
  if (evConfig) {
    const resolved = resolveEvLoadComponentForYear({
      evInput: evConfig,
      year: params.year,
    });
    ev = resolved.component;
    evMeta = resolved.meta;
  }

  const extras: LoadComponent[] = [];
  if (heatPump) extras.push(heatPump);
  if (ev) extras.push(ev);

  const heatPumpLoadKwh = heatPump?.profile ?? null;
  const evLoadKwh = ev?.profile ?? null;
  const mergedLoadKwh = mergeHouseholdLoadComponents({
    householdProfile: householdLoadKwh,
    householdAnnualKwh: params.annualConsumptionKWh,
    extras,
  });

  if (
    householdLoadKwh.length !== STEPS_PER_NON_LEAP_YEAR_15 ||
    mergedLoadKwh.length !== STEPS_PER_NON_LEAP_YEAR_15 ||
    pvKwh.length !== STEPS_PER_NON_LEAP_YEAR_15 ||
    (heatPumpLoadKwh !== null &&
      heatPumpLoadKwh.length !== STEPS_PER_NON_LEAP_YEAR_15) ||
    (evLoadKwh !== null && evLoadKwh.length !== STEPS_PER_NON_LEAP_YEAR_15)
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
    evLoadKwh,
    mergedLoadKwh,
    pvKwh,
    heatPumpMeta,
    evMeta,
  };
}
