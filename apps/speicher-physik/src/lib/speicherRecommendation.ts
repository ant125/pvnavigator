import type { SpeicherChartPoint } from "./speicherChartData";

/** Marginal Eigenverbrauch gain (kWh) below which the plateau is considered reached. */
export const DEFAULT_PLATEAU_DELTA_THRESHOLD_KWH = 50;

/** Upper bound of the battery-size simulation sweep (kWh). */
export const SIMULATED_BATTERY_MAX_KWH = 30;

/** Assumed remaining usable fraction after long-term capacity loss (planning layer). */
export const PLANNING_REMAINING_CAPACITY_FRACTION = 0.75;

export type DeriveRecommendedTechnicalSizeInput = {
  data: ReadonlyArray<Pick<SpeicherChartPoint, "size" | "deltaEigenverbrauch">>;
  plateauDeltaThresholdKwh?: number;
};

/**
 * Last sweep size before marginal Eigenverbrauch gain drops below the threshold.
 * Matches legacy inline logic in the calculate results page.
 */
export function deriveRecommendedTechnicalSize(
  input: DeriveRecommendedTechnicalSizeInput
): number {
  const threshold =
    input.plateauDeltaThresholdKwh ?? DEFAULT_PLATEAU_DELTA_THRESHOLD_KWH;
  const { data } = input;

  for (let i = 1; i < data.length; i++) {
    if (data[i].deltaEigenverbrauch < threshold) {
      return data[i - 1].size;
    }
  }

  return data[data.length - 1]?.size ?? 0;
}

/**
 * Initial usable capacity for purchase planning so that after assumed capacity
 * loss the remaining usable capacity approximates the technical Speichergrenze.
 */
export function deriveRecommendedPlanningSize(
  recommendedTechnicalSize: number
): number {
  if (recommendedTechnicalSize <= 0) {
    return 0;
  }
  return Math.ceil(
    recommendedTechnicalSize / PLANNING_REMAINING_CAPACITY_FRACTION
  );
}

/**
 * Simulation KPI maps are keyed by technical Speichergrenze only — never planning size.
 */
export function getPhysicalKpiLookupSize(recommendedTechnicalSize: number): number {
  return recommendedTechnicalSize;
}
