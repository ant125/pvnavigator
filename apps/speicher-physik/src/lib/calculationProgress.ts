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

export type CalculationProgressStageId =
  | "location"
  | "pvgis"
  | "heatpump"
  | "consumption"
  | "physics";

export type CalculationProgressStage = {
  id: CalculationProgressStageId;
  done: string;
  active: string;
};

const LOCATION_STAGE: CalculationProgressStage = {
  id: "location",
  done: "Standort analysiert",
  active: "Standort wird analysiert",
};

const PVGIS_STAGE: CalculationProgressStage = {
  id: "pvgis",
  done: "PVGIS-Wetterdaten geladen",
  active: "PVGIS-Wetterdaten werden geladen",
};

const HEAT_PUMP_STAGE_LUFTWASSER: CalculationProgressStage = {
  id: "heatpump",
  done: "ThermBuild-Wärmepumpenprofil geladen",
  active: "ThermBuild-Wärmepumpenprofil wird geladen",
};

const HEAT_PUMP_STAGE_WASSERWASSER: CalculationProgressStage = {
  id: "heatpump",
  done: "Wasser/Wasser-Wärmepumpenprofil geladen",
  active: "Wasser/Wasser-Wärmepumpenprofil wird geladen",
};

const CONSUMPTION_STAGE: CalculationProgressStage = {
  id: "consumption",
  done: "Stromverbrauch modelliert",
  active: "Stromverbrauch wird modelliert",
};

const PHYSICS_STAGE: CalculationProgressStage = {
  id: "physics",
  done: "Speicherphysik berechnet",
  active: "Speicherphysik wird berechnet",
};

/**
 * Loading-screen stages. The heat-pump row is presentation-only and
 * appears for Luft/Wasser or Wasser/Wasser. It does not add a backend
 * progress event.
 */
export type HeatPumpProgressKind = false | "luftwasser" | "wasserwasser";

export function getCalculationProgressStages(
  includeHeatPumpProfile: HeatPumpProgressKind = false
): readonly CalculationProgressStage[] {
  if (!includeHeatPumpProfile) {
    return [LOCATION_STAGE, PVGIS_STAGE, CONSUMPTION_STAGE, PHYSICS_STAGE];
  }
  const heatPumpStage =
    includeHeatPumpProfile === "wasserwasser"
      ? HEAT_PUMP_STAGE_WASSERWASSER
      : HEAT_PUMP_STAGE_LUFTWASSER;
  return [
    LOCATION_STAGE,
    PVGIS_STAGE,
    heatPumpStage,
    CONSUMPTION_STAGE,
    PHYSICS_STAGE,
  ];
}

export function isCalculationStageDone(
  stageId: CalculationProgressStageId,
  progress: CalculationProgressState,
  complete: boolean
): boolean {
  if (complete) return true;
  if (stageId === "heatpump") return progress.consumption;
  return progress[stageId];
}

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
