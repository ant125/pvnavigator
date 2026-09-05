import "server-only";

import { TIME_STEP_HOURS_15 } from "../../../../packages/pv-core";
import {
  mergeHouseholdLoadComponents,
  type LoadComponent,
} from "@/load/merge";
import {
  DEFAULT_WEATHER_DATABASE,
  simulateMultiYearSpeicherGrenz,
} from "@/lib/multiYearSimulation";
import {
  kpisAtTechnicalSize,
  mapPool,
} from "@/lib/robustnessSimHelpers";
import {
  loadWpuqCohort,
  scaleProfileToAnnualKwh,
  WPUQ_COHORT_SIZE,
} from "@/lib/wpuqCohort";
import {
  buildWpuqRobustnessPayload,
  type WpuqHouseKpis,
  type WpuqRobustnessPayload,
} from "@/lib/wpuqRobustnessStats";

export type { WpuqHouseKpis, WpuqRobustnessPayload };

const HOUSE_SIM_CONCURRENCY = 2;

function sum(arr: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

function extrasForYear(params: {
  heatPumpComponent: LoadComponent | null;
  evComponent: LoadComponent | null;
}): LoadComponent[] {
  const extras: LoadComponent[] = [];
  if (params.heatPumpComponent) extras.push(params.heatPumpComponent);
  if (params.evComponent) extras.push(params.evComponent);
  return extras;
}

export type RunWpuqHouseholdRobustnessParams = {
  householdAnnualKwh: number;
  /**
   * Customer-scenario heat-pump component, or null when HP is off.
   * Must be the same series used in the BDEW primary calculation.
   * Robustness only changes the household load shape.
   */
  heatPumpComponent?: LoadComponent | null;
  /**
   * Customer EV home-charging component for each target weather year.
   * Omit when EV is off. Do not return one calendar year for every year.
   */
  getEvForYear?: (year: number) => LoadComponent | null;
  getPvForYear: (year: number) => number[] | Promise<number[]>;
  bdewTechnicalSizeKwh: number;
  years?: readonly number[];
  batterySizes?: readonly number[];
  backupReserveKwh?: number;
  /** Called after each finished household kernel. Does not change results. */
  onHouseholdComplete?: (
    completed: number,
    total: number
  ) => void | Promise<void>;
};

/**
 * Repeat the production simulation for each of the 27 WPuQ household shapes.
 * Only the household load shape changes; PV, roof, weather years, battery
 * model, physics, the selected heat-pump component, and the per-year EV
 * home-charging profile are identical to the BDEW run.
 */
export async function runWpuqHouseholdRobustness(
  params: RunWpuqHouseholdRobustnessParams
): Promise<WpuqRobustnessPayload> {
  const cohort = loadWpuqCohort();
  if (cohort.profiles.length !== WPUQ_COHORT_SIZE) {
    throw new Error(
      `WPuQ robustness expects ${WPUQ_COHORT_SIZE} households, got ${cohort.profiles.length}`
    );
  }

  const target = params.householdAnnualKwh;
  let completed = 0;
  let progressQueue = Promise.resolve();
  const reportCompleted = (count: number) => {
    progressQueue = progressQueue.then(() =>
      Promise.resolve(
        params.onHouseholdComplete?.(count, WPUQ_COHORT_SIZE)
      )
    );
    return progressQueue;
  };
  await reportCompleted(0);

  const houses = await mapPool(cohort.profiles, HOUSE_SIM_CONCURRENCY, async (profile) => {
    const scaled = scaleProfileToAnnualKwh(
      profile.intervalEnergyKwh,
      target,
      profile.houseId
    );
    const scaledSum = sum(scaled);
    if (Math.abs(scaledSum - target) > 1e-6 * Math.max(1, target)) {
      throw new Error(
        `${profile.houseId}: scaled household annual ${scaledSum} ≠ ${target}`
      );
    }

    const heatPumpComponent = params.heatPumpComponent ?? null;
    const getEvForYear = params.getEvForYear;
    const mergedWithoutEv = mergeHouseholdLoadComponents({
      householdProfile: scaled,
      householdAnnualKwh: target,
      extras: extrasForYear({
        heatPumpComponent,
        evComponent: null,
      }),
    });

    const kernel = await simulateMultiYearSpeicherGrenz({
      getLoadForYear: getEvForYear
        ? (year) =>
            mergeHouseholdLoadComponents({
              householdProfile: scaled,
              householdAnnualKwh: target,
              extras: extrasForYear({
                heatPumpComponent,
                evComponent: getEvForYear(year),
              }),
            })
        : () => mergedWithoutEv,
      getPvForYear: params.getPvForYear,
      latitude: 0,
      longitude: 0,
      years: params.years,
      batterySizes: params.batterySizes,
      backupReserveKwh: params.backupReserveKwh,
      includeHourly: false,
      timeStepHours: TIME_STEP_HOURS_15,
      weatherDatabase: DEFAULT_WEATHER_DATABASE,
    });

    const metrics = kpisAtTechnicalSize(kernel);
    const kpis: WpuqHouseKpis = {
      houseId: profile.houseId,
      ...metrics,
    };
    completed += 1;
    await reportCompleted(completed);
    return kpis;
  });

  await progressQueue;

  return buildWpuqRobustnessPayload({
    houses,
    householdAnnualKwh: target,
    bdewTechnicalSizeKwh: params.bdewTechnicalSizeKwh,
  });
}
