/**
 * Calculation progress events for the SpeicherGrenze loading screen.
 * Reporting only — does not affect physics or results.
 */
export const SMART_METER_HOUSEHOLD_COUNT = 27;

/** Brief pause on the completed loading screen before opening the report. */
export const CALCULATION_COMPLETE_PAUSE_MS = 900;

/**
 * Wall-clock duration for the report footer. German decimal comma, one
 * fractional digit — presentation only.
 */
export function formatCalculationDurationDe(durationMs: number): string {
  return (durationMs / 1000).toFixed(1).replace(".", ",");
}

export type CalculationProgressEvent =
  | { stage: "location" }
  | { stage: "pvgis" }
  | { stage: "consumption" }
  | { stage: "physics" }
  | {
      stage: "smartmeter";
      completed: number;
      total: number;
    };

export type CalculationProgressHandler = (
  event: CalculationProgressEvent
) => void | Promise<void>;

export type CalculationProgressState = {
  location: boolean;
  pvgis: boolean;
  consumption: boolean;
  physics: boolean;
  smartmeterCompleted: number;
  smartmeterTotal: number;
};

export const INITIAL_CALCULATION_PROGRESS: CalculationProgressState = {
  location: false,
  pvgis: false,
  consumption: false,
  physics: false,
  smartmeterCompleted: 0,
  smartmeterTotal: SMART_METER_HOUSEHOLD_COUNT,
};

export function applyCalculationProgress(
  prev: CalculationProgressState,
  event: CalculationProgressEvent
): CalculationProgressState {
  if (event.stage === "smartmeter") {
    return {
      ...prev,
      physics: true,
      smartmeterCompleted: event.completed,
      smartmeterTotal: event.total,
    };
  }
  return { ...prev, [event.stage]: true };
}
