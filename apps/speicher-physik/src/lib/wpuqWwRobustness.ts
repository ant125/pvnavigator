import "server-only";

import { scaleUniformEnergy } from "@heatpump-profile/loader";
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
  loadWpuqWwRobustnessCohort,
  WPUQ_WW_ROBUSTNESS_SIZE,
} from "@/lib/wpuqWwRobustnessCohort";
import {
  buildWwRobustnessPayload,
  type WwRobustnessPayload,
  type WwRobustnessProfileKpis,
} from "@/lib/wpuqWwRobustnessStats";

export type { WwRobustnessPayload, WwRobustnessProfileKpis };

const PROFILE_SIM_CONCURRENCY = 2;

function sum(arr: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

function heatPumpComponentFromWeights(params: {
  profileId: string;
  weights: ArrayLike<number>;
  annualElectricalKwh: number;
}): LoadComponent {
  const weightArr =
    params.weights instanceof Float64Array
      ? Array.from(params.weights)
      : Array.from(params.weights as ArrayLike<number>);
  const { profile } = scaleUniformEnergy(
    weightArr,
    params.annualElectricalKwh
  );
  const annual = sum(profile);
  if (
    Math.abs(annual - params.annualElectricalKwh) >
    1e-6 * Math.max(1, params.annualElectricalKwh)
  ) {
    throw new Error(
      `${params.profileId}: scaled HP annual ${annual} ≠ ${params.annualElectricalKwh}`
    );
  }
  return {
    name: "heatPump",
    yearlyConsumption: params.annualElectricalKwh,
    profile,
  };
}

export type RunWpuqWasserWasserRobustnessParams = {
  householdAnnualKwh: number;
  heatPumpAnnualKwh: number;
  /**
   * BDEW (or other) household series for each weather year — identical to the
   * primary calculation. Robustness only replaces the heat-pump component.
   * Must be synchronous (physical kernel does not await load getters).
   */
  getHouseholdForYear: (year: number) => number[];
  /**
   * Customer EV home-charging component for each target weather year.
   * Same customer EV input as the primary run. Omit when EV is off.
   */
  getEvForYear?: (year: number) => LoadComponent | null;
  getPvForYear: (year: number) => number[] | Promise<number[]>;
  productionTechnicalSizeKwh: number;
  years?: readonly number[];
  batterySizes?: readonly number[];
  backupReserveKwh?: number;
  /** Called after each finished WW profile kernel. Does not change results. */
  onProfileComplete?: (
    completed: number,
    total: number
  ) => void | Promise<void>;
};

/**
 * Repeat the production simulation for each of the 24 measured WW HP shapes.
 * Only the heat-pump load shape changes; household (BDEW), per-year EV,
 * PV, roof, weather years, battery model, and physics are identical to the
 * primary run. The production SFH38 profile is never replaced in the
 * primary result.
 */
export async function runWpuqWasserWasserRobustness(
  params: RunWpuqWasserWasserRobustnessParams
): Promise<WwRobustnessPayload> {
  const cohort = loadWpuqWwRobustnessCohort();
  if (cohort.profiles.length !== WPUQ_WW_ROBUSTNESS_SIZE) {
    throw new Error(
      `WW robustness expects ${WPUQ_WW_ROBUSTNESS_SIZE} profiles, got ${cohort.profiles.length}`
    );
  }

  const hpTarget = params.heatPumpAnnualKwh;
  let completed = 0;
  let progressQueue = Promise.resolve();
  const reportCompleted = (count: number) => {
    progressQueue = progressQueue.then(() =>
      Promise.resolve(params.onProfileComplete?.(count, WPUQ_WW_ROBUSTNESS_SIZE))
    );
    return progressQueue;
  };
  await reportCompleted(0);

  const years = params.years;
  const profiles = await mapPool(
    cohort.profiles,
    PROFILE_SIM_CONCURRENCY,
    async (entry) => {
      const heatPump = heatPumpComponentFromWeights({
        profileId: entry.profileId,
        weights: entry.weights,
        annualElectricalKwh: hpTarget,
      });

      const kernel = await simulateMultiYearSpeicherGrenz({
        getLoadForYear: (year) => {
          const extras: LoadComponent[] = [heatPump];
          const ev = params.getEvForYear?.(year) ?? null;
          if (ev) extras.push(ev);
          return mergeHouseholdLoadComponents({
            householdProfile: params.getHouseholdForYear(year),
            householdAnnualKwh: params.householdAnnualKwh,
            extras,
          });
        },
        getPvForYear: params.getPvForYear,
        latitude: 0,
        longitude: 0,
        years,
        batterySizes: params.batterySizes,
        backupReserveKwh: params.backupReserveKwh,
        includeHourly: false,
        timeStepHours: TIME_STEP_HOURS_15,
        weatherDatabase: DEFAULT_WEATHER_DATABASE,
      });

      const metrics = kpisAtTechnicalSize(kernel);
      const kpis: WwRobustnessProfileKpis = {
        profileId: entry.profileId,
        houseId: entry.houseId,
        ...metrics,
      };
      completed += 1;
      await reportCompleted(completed);
      return kpis;
    }
  );

  await progressQueue;

  return buildWwRobustnessPayload({
    profiles,
    heatPumpAnnualKwh: hpTarget,
    productionTechnicalSizeKwh: params.productionTechnicalSizeKwh,
  });
}
