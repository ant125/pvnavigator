import { percentile } from "@/lib/wpuqRobustnessStats";
import type { RobustnessMetricKpis } from "@/lib/robustnessSimHelpers";

/**
 * Wasser/Wasser heat-pump robustness payload.
 * Independent from household WPuQ robustness (`WpuqRobustnessPayload`).
 * Aggregates use min / max / median / mean (no UI selection yet).
 */

export type WwRobustnessProfileKpis = RobustnessMetricKpis & {
  profileId: string;
  houseId: string;
};

/** Aggregates requested for WW robustness (store everything; UI later). */
export type WwMetricAggregate = {
  min: number;
  max: number;
  median: number;
  mean: number;
};

export type WwRobustnessPayload = {
  cohortSize: number;
  heatPumpAnnualKwh: number;
  /** Production SFH38 technical size from the primary WW calculation. */
  productionTechnicalSizeKwh: number;
  sizeUnchangedCount: number;
  aggregates: {
    eigenverbrauchKwh: WwMetricAggregate;
    eigenverbrauchsquotePct: WwMetricAggregate;
    autarkiePct: WwMetricAggregate;
    netzbezugKwh: WwMetricAggregate;
    einspeisungKwh: WwMetricAggregate;
    technicalSpeichergrenzeKwh: WwMetricAggregate;
  };
  profiles: WwRobustnessProfileKpis[];
};

export function metricAggregate(
  values: readonly number[]
): WwMetricAggregate {
  const arr = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (arr.length === 0) {
    throw new Error("metricAggregate: no finite values");
  }
  let sum = 0;
  for (const v of arr) sum += v;
  return {
    min: arr[0],
    max: arr[arr.length - 1],
    median: percentile(arr, 50),
    mean: sum / arr.length,
  };
}

export function buildWwRobustnessPayload(params: {
  profiles: readonly WwRobustnessProfileKpis[];
  heatPumpAnnualKwh: number;
  productionTechnicalSizeKwh: number;
}): WwRobustnessPayload {
  const { profiles, heatPumpAnnualKwh, productionTechnicalSizeKwh } = params;
  if (profiles.length === 0) {
    throw new Error("buildWwRobustnessPayload: expected profile results");
  }

  const sizeUnchangedCount = profiles.filter(
    (p) => p.technicalSpeichergrenzeKwh === productionTechnicalSizeKwh
  ).length;

  return {
    cohortSize: profiles.length,
    heatPumpAnnualKwh,
    productionTechnicalSizeKwh,
    sizeUnchangedCount,
    aggregates: {
      eigenverbrauchKwh: metricAggregate(
        profiles.map((p) => p.eigenverbrauchKwh)
      ),
      eigenverbrauchsquotePct: metricAggregate(
        profiles.map((p) => p.eigenverbrauchsquotePct)
      ),
      autarkiePct: metricAggregate(profiles.map((p) => p.autarkiePct)),
      netzbezugKwh: metricAggregate(profiles.map((p) => p.netzbezugKwh)),
      einspeisungKwh: metricAggregate(profiles.map((p) => p.einspeisungKwh)),
      technicalSpeichergrenzeKwh: metricAggregate(
        profiles.map((p) => p.technicalSpeichergrenzeKwh)
      ),
    },
    profiles: profiles.slice(),
  };
}
