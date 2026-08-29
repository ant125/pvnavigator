/**
 * Physical kernel – serializable multi-year battery physics result.
 * Pure math, no I/O, no React, no Server Actions.
 *
 * Pipeline:
 *   Calculation Input
 *     → PhysicalKernelResult   (this module; kept server-side)
 *       → SpeicherGrenzPayload (compact averages for the free UI)
 *         → future DB persistence of PhysicalKernelResult
 */

import {
  calculateBatterySimulation,
  BATTERY_MODEL_VERSION,
  DEFAULT_BATTERY_SPEC,
  DEFAULT_TIME_STEP_HOURS,
  type BatterySpec,
  type BatterySimulationResult,
} from "./battery";
import { calculateEigenverbrauch } from "./eigenverbrauch";
import { expectedStepsPerYearForTimeStepHours } from "./quarterHourGrid";

/** Inclusive start of the physical weather-year reference period (PVGIS-SARAH2). */
export const DEFAULT_MULTI_YEAR_START = 2006;
/** Inclusive end of the physical weather-year reference period (PVGIS-SARAH2). */
export const DEFAULT_MULTI_YEAR_END = 2020;

/** Default weather years: 2006–2020 (15 independent simulations). */
export const DEFAULT_MULTI_YEAR_YEARS: ReadonlyArray<number> = Array.from(
  { length: DEFAULT_MULTI_YEAR_END - DEFAULT_MULTI_YEAR_START + 1 },
  (_, i) => DEFAULT_MULTI_YEAR_START + i
);

export const DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH: ReadonlyArray<number> =
  Array.from({ length: 26 }, (_, i) => i + 5);

/**
 * Shape version of PhysicalKernelResult (independent of battery physics).
 * Bump when adding/removing/renaming kernel fields, not when changing
 * efficiencies or dispatch (that is BATTERY_MODEL_VERSION).
 *
 * 1.1.0: meta.timeStepHours / timeStepMinutes / stepsPerYear added.
 */
export const PHYSICAL_KERNEL_SCHEMA_VERSION = "1.1.0" as const;

/** Production PVGIS radiation database used by the orchestrator. */
export const DEFAULT_WEATHER_DATABASE = "PVGIS-SARAH2" as const;

/**
 * Per-step battery + grid series for one (year, size) pair.
 * PV and load are stored once per weather year, not here.
 * Field names remain `hourly*` for API compatibility; one sample per
 * simulation step (a clock hour only when `timeStepHours` is 1).
 */
export type PhysicalKernelHourlySeries = {
  /** SoC fraction after the step (same convention as `socHourly`). */
  soc: number[];
  /** AC surplus entering the charge path (`toChargeRaw`), kWh per step. */
  batteryChargeKwh: number[];
  /** AC energy delivered from the battery (household + aux), kWh per step. */
  batteryDischargeKwh: number[];
  /** Grid import serving residual household + auxiliary, kWh per step. */
  gridImportKwh: number[];
  /** PV surplus not stored → export, kWh per step. */
  gridExportKwh: number[];
};

/**
 * Annual physical result for one weather year × one battery size.
 * JSON-serializable; no class instances.
 */
export type PhysicalKernelBatteryYearResult = {
  usableCapacityKwh: number;
  selfConsumptionWithStorageKwh: number;
  gridToHouseholdKwh: number;
  gridToAuxiliaryKwh: number;
  /** gridToHouseholdKwh + gridToAuxiliaryKwh */
  gridImportKwh: number;
  gridExportKwh: number;
  batteryChargedKwh: number;
  batteryDischargedKwh: number;
  batteryChargedStoredKwh: number;
  batteryDischargedFromSocKwh: number;
  /**
   * Current-model cycles: AC discharged / usable capacity.
   * Not a rainflow or degradation result.
   */
  equivalentFullCyclesAc: number;
  chargeLossKwh: number;
  dischargeLossKwh: number;
  chargeLossPvToBatteryKwh?: number;
  chargeLossChemicalKwh?: number;
  dischargeLossChemicalKwh?: number;
  dischargeLossBatteryToAcKwh?: number;
  selfDischargeLossKwh: number;
  /** chargeLoss + dischargeLoss + selfDischarge (UI Batterieverluste). */
  batteryLossesKwh: number;
  auxiliaryConsumptionKwh: number;
  directPvToHouseholdKwh: number;
  directPvToAuxiliaryKwh: number;
  batteryToHouseholdKwh: number;
  batteryToAuxiliaryKwh: number;
  socStartKwh: number;
  socStartPct: number;
  socEndKwh: number;
  socEndPct: number;
  energyBalanceErrorKwh: number;
  /**
   * Household Eigenverbrauch / household load (0–1). Diagnostic only.
   * Aggregated Autarkie remains the quotient of multi-year means.
   */
  autarkie: number;
  /**
   * Household Eigenverbrauch / PV yield (0–1). Diagnostic only.
   * Aggregated Eigenverbrauchsquote remains the quotient of means.
   */
  eigenverbrauchsquote: number;
  /** Present only when hourly collection is enabled for this size. */
  hourly?: PhysicalKernelHourlySeries;
};

export type PhysicalKernelYearResult = {
  year: number;
  pvYieldKwh: number;
  loadKwh: number;
  selfConsumptionWithoutStorageKwh: number;
  /**
   * PV series for this weather year (one sample per simulation step).
   * Stored once (not per battery size). Present only when `includeHourly` is true.
   */
  hourlyPvKwh?: number[];
  /**
   * Household (+ merged HP) load for this weather year (one sample per step).
   * Stored once. Present only when `includeHourly` is true.
   */
  hourlyLoadKwh?: number[];
  batteries: PhysicalKernelBatteryYearResult[];
};

export type PhysicalKernelMeta = {
  /** Battery physics model (`BATTERY_MODEL_VERSION`). */
  modelVersion: typeof BATTERY_MODEL_VERSION;
  /** PhysicalKernelResult JSON shape version. */
  kernelSchemaVersion: typeof PHYSICAL_KERNEL_SCHEMA_VERSION;
  weatherDatabase: string;
  weatherPeriod: {
    startYear: number;
    endYear: number;
  };
  createdAt: string;
  includeHourly: boolean;
  /** Sizes that actually received hourly series (empty when includeHourly is false). */
  hourlyBatterySizes: number[];
  /** Simulation step duration in hours (production: 0.25). */
  timeStepHours: number;
  /** Simulation step duration in minutes (production: 15). */
  timeStepMinutes: number;
  /** Steps per weather year (production: 35040). */
  stepsPerYear: number;
};

/**
 * Compact multi-year averages — identical semantics to Phase 2.
 * These fields are copied into SpeicherGrenzPayload for the free UI.
 */
export type PhysicalKernelAggregates = {
  average: Record<number, number>;
  averageBatteryChargedKwh: Record<number, number>;
  averageBatteryDischargedKwh: Record<number, number>;
  averageDirectPvToHouseholdKwh: Record<number, number>;
  averageDirectPvToAuxiliaryKwh: Record<number, number>;
  averageBatteryToHouseholdKwh: Record<number, number>;
  averageBatteryToAuxiliaryKwh: Record<number, number>;
  averageGridToHouseholdKwh: Record<number, number>;
  averageGridToAuxiliaryKwh: Record<number, number>;
  averageGridExportKwh: Record<number, number>;
  averageAuxiliaryConsumptionKwh: Record<number, number>;
  averageChargeLossKwh: Record<number, number>;
  averageDischargeLossKwh: Record<number, number>;
  averageChargeLossPvToBatteryKwh: Record<number, number>;
  averageChargeLossChemicalKwh: Record<number, number>;
  averageDischargeLossChemicalKwh: Record<number, number>;
  averageDischargeLossBatteryToAcKwh: Record<number, number>;
  averageSocStartKwh: Record<number, number>;
  averageSocEndKwh: Record<number, number>;
  averageSocEndPct: Record<number, number>;
  averageEnergyBalanceErrorKwh: Record<number, number>;
  averageSelfDischargeLossKwh: Record<number, number>;
  averageSelfConsumptionWithoutStorageKwh: number;
  averagePvYieldKwhAnnual: number;
  averageLoadKwhAnnual: number;
};

/**
 * Internal serializable physical result.
 * Must not be sent to the browser as-is (use compact aggregates instead).
 */
export type PhysicalKernelResult = PhysicalKernelAggregates & {
  meta: PhysicalKernelMeta;
  batterySizes: number[];
  /**
   * Compact Eigenverbrauch index year → size → kWh.
   * Same shape as Phase 2 `yearly`; full ledgers live in `years`.
   */
  yearly: Record<number, Record<number, number>>;
  years: PhysicalKernelYearResult[];
  batteryModelVersion: typeof BATTERY_MODEL_VERSION;
};

export type RunPhysicalKernelParams = {
  years?: ReadonlyArray<number>;
  batterySizes?: ReadonlyArray<number>;
  getLoadForYear: (year: number) => number[];
  getPvForYear: (year: number) => number[];
  batterySpec?: BatterySpec;
  backupReserveKwh?: number;
  /**
   * Duration of one battery simulation step in hours.
   * Default {@link DEFAULT_TIME_STEP_HOURS} (1) for hourly regression.
   * Production SpeicherGrenze passes {@link TIME_STEP_HOURS_15} (0.25).
   * Year length must match: dt=1 → 8760, dt=0.25 → 35040.
   */
  timeStepHours?: number;
  /**
   * When false (default), no per-step arrays are retained on the result.
   * SpeicherGrenze production path must leave this false.
   * `hourly*` series are per simulation step, not necessarily per clock hour.
   */
  includeHourly?: boolean;
  /**
   * If `includeHourly` is true, collect battery hourly series only for these
   * sizes. Omit to collect for every simulated size. PV/load hourly series
   * are still stored once per year whenever `includeHourly` is true.
   */
  hourlyBatterySizes?: ReadonlyArray<number>;
  weatherDatabase?: string;
  createdAt?: string;
};

function assertYearSeries(
  arr: number[],
  label: string,
  expectedLength: number
): void {
  if (arr.length !== expectedLength) {
    throw new Error(
      `${label} length mismatch: expected ${expectedLength}, got ${arr.length}`
    );
  }
  for (let i = 0; i < expectedLength; i++) {
    const v = arr[i];
    if (!Number.isFinite(v)) {
      throw new Error(`${label}[${i}] is not finite`);
    }
    if (v < 0) {
      throw new Error(`${label}[${i}] is negative`);
    }
  }
}

function sumFinite(values: number[]): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum;
}

function averageFiniteYears(
  years: readonly number[],
  yearlyValues: Record<number, number>
): number {
  let sum = 0;
  let count = 0;
  for (const year of years) {
    const v = yearlyValues[year];
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

function toBatteryYearResult(
  size: number,
  result: BatterySimulationResult,
  loadKwhAnnual: number,
  pvYieldKwh: number,
  hourly?: PhysicalKernelHourlySeries
): PhysicalKernelBatteryYearResult {
  const gridImportKwh =
    result.gridToHouseholdKwh + result.gridToAuxiliaryKwh;
  const batteryLossesKwh =
    result.chargeLossKwh +
    result.dischargeLossKwh +
    result.totalSelfDischargeLossKwh;

  const out: PhysicalKernelBatteryYearResult = {
    usableCapacityKwh: size,
    selfConsumptionWithStorageKwh: result.selfConsumptionWithStorage,
    gridToHouseholdKwh: result.gridToHouseholdKwh,
    gridToAuxiliaryKwh: result.gridToAuxiliaryKwh,
    gridImportKwh,
    gridExportKwh: result.gridExportKwh,
    batteryChargedKwh: result.totalChargedKwh,
    batteryDischargedKwh: result.totalDischargedKwh,
    batteryChargedStoredKwh: result.totalChargedStoredKwh,
    batteryDischargedFromSocKwh: result.totalDischargedFromSocKwh,
    equivalentFullCyclesAc: result.cyclesPerYear,
    chargeLossKwh: result.chargeLossKwh,
    dischargeLossKwh: result.dischargeLossKwh,
    selfDischargeLossKwh: result.totalSelfDischargeLossKwh,
    batteryLossesKwh,
    auxiliaryConsumptionKwh: result.auxiliaryConsumptionKwh,
    directPvToHouseholdKwh: result.directPvToHouseholdKwh,
    directPvToAuxiliaryKwh: result.directPvToAuxiliaryKwh,
    batteryToHouseholdKwh: result.batteryToHouseholdKwh,
    batteryToAuxiliaryKwh: result.batteryToAuxiliaryKwh,
    socStartKwh: result.socStartKwh,
    socStartPct: result.socStartPct,
    socEndKwh: result.socEndKwh,
    socEndPct: result.socEndPct,
    energyBalanceErrorKwh: result.energyBalanceErrorKwh,
    autarkie:
      loadKwhAnnual > 0
        ? result.selfConsumptionWithStorage / loadKwhAnnual
        : 0,
    eigenverbrauchsquote:
      pvYieldKwh > 0 ? result.selfConsumptionWithStorage / pvYieldKwh : 0,
  };

  if (typeof result.chargeLossPvToBatteryKwh === "number") {
    out.chargeLossPvToBatteryKwh = result.chargeLossPvToBatteryKwh;
  }
  if (typeof result.chargeLossChemicalKwh === "number") {
    out.chargeLossChemicalKwh = result.chargeLossChemicalKwh;
  }
  if (typeof result.dischargeLossChemicalKwh === "number") {
    out.dischargeLossChemicalKwh = result.dischargeLossChemicalKwh;
  }
  if (typeof result.dischargeLossBatteryToAcKwh === "number") {
    out.dischargeLossBatteryToAcKwh = result.dischargeLossBatteryToAcKwh;
  }
  if (hourly) {
    out.hourly = hourly;
  }
  return out;
}

function pickHourly(
  result: BatterySimulationResult
): PhysicalKernelHourlySeries | undefined {
  if (
    !result.hourlyChargeKwh ||
    !result.hourlyDischargeKwh ||
    !result.hourlyGridImportKwh ||
    !result.hourlyGridExportKwh
  ) {
    return undefined;
  }
  return {
    soc: result.socHourly,
    batteryChargeKwh: result.hourlyChargeKwh,
    batteryDischargeKwh: result.hourlyDischargeKwh,
    gridImportKwh: result.hourlyGridImportKwh,
    gridExportKwh: result.hourlyGridExportKwh,
  };
}

function averageBySize(
  years: PhysicalKernelYearResult[],
  batterySizes: number[],
  pick: (b: PhysicalKernelBatteryYearResult) => number | undefined
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const size of batterySizes) {
    let sum = 0;
    let count = 0;
    for (const y of years) {
      const b = y.batteries.find((row) => row.usableCapacityKwh === size);
      const v = b ? pick(b) : undefined;
      if (typeof v === "number" && Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    out[size] = count > 0 ? sum / count : 0;
  }
  return out;
}

export function findKernelYear(
  result: PhysicalKernelResult,
  year: number
): PhysicalKernelYearResult | undefined {
  return result.years.find((y) => y.year === year);
}

export function findKernelYearBattery(
  yearResult: PhysicalKernelYearResult,
  usableCapacityKwh: number
): PhysicalKernelBatteryYearResult | undefined {
  return yearResult.batteries.find(
    (b) => b.usableCapacityKwh === usableCapacityKwh
  );
}

/**
 * Multi-year physical kernel: one independent `calculateBatterySimulation`
 * per (weather year, battery size). Averages are the arithmetic mean of
 * yearly physical results (same as Phase 2). SpeicherGrenze is **not**
 * computed here — it is derived later from the mean Eigenverbrauch curve.
 */
export function runPhysicalKernel(
  params: RunPhysicalKernelParams
): PhysicalKernelResult {
  const years = (params.years ?? DEFAULT_MULTI_YEAR_YEARS).slice();
  const batterySizes = (
    params.batterySizes ?? DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH
  ).slice();
  const spec = params.batterySpec ?? DEFAULT_BATTERY_SPEC;
  const timeStepHours = params.timeStepHours ?? DEFAULT_TIME_STEP_HOURS;
  const stepsPerYear = expectedStepsPerYearForTimeStepHours(timeStepHours);
  const timeStepMinutes = timeStepHours * 60;
  const includeHourly = params.includeHourly === true;
  const hourlySizeSet = new Set(
    (params.hourlyBatterySizes ?? (includeHourly ? batterySizes : [])).slice()
  );
  const hourlyBatterySizes = includeHourly
    ? batterySizes.filter((s) => hourlySizeSet.has(s))
    : [];

  if (years.length === 0) {
    throw new Error("years must contain at least one year");
  }
  if (batterySizes.length === 0) {
    throw new Error("batterySizes must contain at least one size");
  }
  if (batterySizes.some((s) => !Number.isFinite(s) || s <= 0)) {
    throw new Error("batterySizes must contain only positive finite numbers");
  }

  const yearResults: PhysicalKernelYearResult[] = [];
  const yearly: Record<number, Record<number, number>> = {};
  const yearlySelfConsumptionWithoutStorage: Record<number, number> = {};
  const yearlyPvYieldKwh: Record<number, number> = {};
  const yearlyLoadKwh: Record<number, number> = {};

  for (const year of years) {
    const pvProfile = params.getPvForYear(year);
    const loadKwhYear = params.getLoadForYear(year);
    if (pvProfile.length !== loadKwhYear.length) {
      throw new Error(
        `pv/load length mismatch for year ${year}: pv=${pvProfile.length}, load=${loadKwhYear.length}`
      );
    }
    assertYearSeries(pvProfile, `pv year ${year}`, stepsPerYear);
    assertYearSeries(loadKwhYear, `load year ${year}`, stepsPerYear);

    const loadSum = sumFinite(loadKwhYear);
    const pvSum = sumFinite(pvProfile);
    const ev0 = calculateEigenverbrauch(loadKwhYear, pvProfile);

    yearlyLoadKwh[year] = loadSum;
    yearlyPvYieldKwh[year] = pvSum;
    yearlySelfConsumptionWithoutStorage[year] = ev0;

    const sizeMap: Record<number, number> = {};
    const batteries: PhysicalKernelBatteryYearResult[] = [];

    for (const size of batterySizes) {
      const collectHourlyForSize =
        includeHourly && hourlySizeSet.has(size);
      const result = calculateBatterySimulation(
        loadKwhYear,
        pvProfile,
        size,
        spec,
        params.backupReserveKwh ?? 0,
        {
          includeHourly: collectHourlyForSize,
          timeStepHours,
        }
      );
      if (result.batteryModelVersion !== BATTERY_MODEL_VERSION) {
        throw new Error(
          `Battery model version mismatch: expected ${BATTERY_MODEL_VERSION}, got ${result.batteryModelVersion}`
        );
      }
      sizeMap[size] = result.selfConsumptionWithStorage;
      batteries.push(
        toBatteryYearResult(
          size,
          result,
          loadSum,
          pvSum,
          collectHourlyForSize ? pickHourly(result) : undefined
        )
      );
    }

    yearly[year] = sizeMap;

    const yearRow: PhysicalKernelYearResult = {
      year,
      pvYieldKwh: pvSum,
      loadKwh: loadSum,
      selfConsumptionWithoutStorageKwh: ev0,
      batteries,
    };
    if (includeHourly) {
      yearRow.hourlyPvKwh = pvProfile;
      yearRow.hourlyLoadKwh = loadKwhYear;
    }
    yearResults.push(yearRow);
  }

  const average = averageBySize(
    yearResults,
    batterySizes,
    (b) => b.selfConsumptionWithStorageKwh
  );
  const averageBatteryChargedKwh = averageBySize(
    yearResults,
    batterySizes,
    (b) => b.batteryChargedKwh
  );
  const averageBatteryDischargedKwh = averageBySize(
    yearResults,
    batterySizes,
    (b) => b.batteryDischargedKwh
  );

  const kernel: PhysicalKernelResult = {
    meta: {
      modelVersion: BATTERY_MODEL_VERSION,
      kernelSchemaVersion: PHYSICAL_KERNEL_SCHEMA_VERSION,
      weatherDatabase: params.weatherDatabase ?? DEFAULT_WEATHER_DATABASE,
      weatherPeriod: {
        startYear: Math.min(...years),
        endYear: Math.max(...years),
      },
      createdAt: params.createdAt ?? new Date().toISOString(),
      includeHourly,
      hourlyBatterySizes,
      timeStepHours,
      timeStepMinutes,
      stepsPerYear,
    },
    batterySizes,
    yearly,
    years: yearResults,
    average,
    averageBatteryChargedKwh,
    averageBatteryDischargedKwh,
    averageDirectPvToHouseholdKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.directPvToHouseholdKwh
    ),
    averageDirectPvToAuxiliaryKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.directPvToAuxiliaryKwh
    ),
    averageBatteryToHouseholdKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.batteryToHouseholdKwh
    ),
    averageBatteryToAuxiliaryKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.batteryToAuxiliaryKwh
    ),
    averageGridToHouseholdKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.gridToHouseholdKwh
    ),
    averageGridToAuxiliaryKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.gridToAuxiliaryKwh
    ),
    averageGridExportKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.gridExportKwh
    ),
    averageAuxiliaryConsumptionKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.auxiliaryConsumptionKwh
    ),
    averageChargeLossKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.chargeLossKwh
    ),
    averageDischargeLossKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.dischargeLossKwh
    ),
    averageChargeLossPvToBatteryKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.chargeLossPvToBatteryKwh
    ),
    averageChargeLossChemicalKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.chargeLossChemicalKwh
    ),
    averageDischargeLossChemicalKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.dischargeLossChemicalKwh
    ),
    averageDischargeLossBatteryToAcKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.dischargeLossBatteryToAcKwh
    ),
    averageSocStartKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.socStartKwh
    ),
    averageSocEndKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.socEndKwh
    ),
    averageSocEndPct: averageBySize(yearResults, batterySizes, (b) => b.socEndPct),
    averageEnergyBalanceErrorKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.energyBalanceErrorKwh
    ),
    averageSelfDischargeLossKwh: averageBySize(
      yearResults,
      batterySizes,
      (b) => b.selfDischargeLossKwh
    ),
    averageSelfConsumptionWithoutStorageKwh: averageFiniteYears(
      years,
      yearlySelfConsumptionWithoutStorage
    ),
    averagePvYieldKwhAnnual: averageFiniteYears(years, yearlyPvYieldKwh),
    averageLoadKwhAnnual: averageFiniteYears(years, yearlyLoadKwh),
    batteryModelVersion: BATTERY_MODEL_VERSION,
  };

  return kernel;
}
