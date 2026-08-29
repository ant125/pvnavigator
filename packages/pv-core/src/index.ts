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
  DEFAULT_TIME_STEP_HOURS,
  BATTERY_MODEL_VERSION,
  type BatterySpec,
  type BatterySimulationResult,
  type BatterySimulationHourlyOptions,
  type LifecycleResult,
} from "./battery";

export {
  resolveHybridBatteryPowerLimitKw,
  resolveBatteryPowerLimitsKw,
  type BatteryPowerLimitFields,
} from "./batteryPowerLimit";

export {
  calculateMultiYearAggregation,
  type MultiYearAggregationResult,
  type MultiYearScenario,
} from "./multiYear";

export {
  TIME_STEP_MINUTES_15,
  TIME_STEP_HOURS_15,
  STEPS_PER_HOUR_15,
  STEPS_PER_DAY_15,
  STEPS_PER_NON_LEAP_YEAR_15,
  STEPS_PER_NON_LEAP_YEAR_HOURLY,
  expandHourlyEnergyToQuarterHours,
  expandHourlyEnergyToQuarterHoursByYear,
  expectedStepsPerYearForTimeStepHours,
} from "./quarterHourGrid";

export {
  runPhysicalKernel,
  findKernelYear,
  findKernelYearBattery,
  DEFAULT_MULTI_YEAR_START,
  DEFAULT_MULTI_YEAR_END,
  DEFAULT_MULTI_YEAR_YEARS,
  DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH,
  PHYSICAL_KERNEL_SCHEMA_VERSION,
  DEFAULT_WEATHER_DATABASE,
  type PhysicalKernelResult,
  type PhysicalKernelMeta,
  type PhysicalKernelYearResult,
  type PhysicalKernelBatteryYearResult,
  type PhysicalKernelHourlySeries,
  type PhysicalKernelAggregates,
  type RunPhysicalKernelParams,
} from "./physicalKernel";
