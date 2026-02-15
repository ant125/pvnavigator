/**
 * PV Core – verified energy calculations.
 * Pure math, no React, no Next. Server-safe (no Node-specific APIs).
 */

export {
  calculateEigenverbrauch,
  calculateSelfConsumptionWithoutStorage,
} from "./eigenverbrauch";

export {
  calculateBatterySimulation,
  calculateCyclesPerYear,
  calculateLifecycle,
  estimateAnnualDischargedEnergy,
  DEFAULT_BATTERY_SPEC,
  type BatterySpec,
  type BatterySimulationResult,
  type LifecycleResult,
} from "./battery";

export {
  calculateMultiYearAggregation,
  type MultiYearAggregationResult,
  type MultiYearScenario,
} from "./multiYear";
