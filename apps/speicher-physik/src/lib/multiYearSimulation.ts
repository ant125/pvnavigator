import "server-only";
import { loadPVGISHourlyProfile } from "@pvgis-adapter/core";
import {
  calculateBatterySimulation,
  DEFAULT_BATTERY_SPEC,
  type BatterySpec,
} from "@pv-core/calculations";

const HOURS_PER_YEAR = 8760;

export const DEFAULT_MULTI_YEAR_YEARS: ReadonlyArray<number> = [
  2016, 2017, 2018, 2019, 2020,
];

export const DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH: ReadonlyArray<number> =
  Array.from({ length: 26 }, (_, i) => i + 5);

export type SimulateMultiYearSpeicherGrenzParams = {
  loadKwh: number[];
  pvSystemKwP: number;
  latitude: number;
  longitude: number;
  tiltDeg: number;
  azimuthDeg: number;
  years?: ReadonlyArray<number>;
  batterySizes?: ReadonlyArray<number>;
  batterySpec?: BatterySpec;
};

export type SimulateMultiYearSpeicherGrenzResult = {
  batterySizes: number[];
  yearly: Record<number, Record<number, number>>;
  average: Record<number, number>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertHourlyArray(arr: number[], label: string): void {
  if (arr.length !== HOURS_PER_YEAR) {
    throw new Error(
      `${label} length mismatch: expected ${HOURS_PER_YEAR}, got ${arr.length}`
    );
  }
  for (let i = 0; i < HOURS_PER_YEAR; i++) {
    const v = arr[i];
    if (!Number.isFinite(v)) {
      throw new Error(`${label}[${i}] is not finite`);
    }
    if (v < 0) {
      throw new Error(`${label}[${i}] is negative`);
    }
  }
}

/**
 * Multi-year orchestration: runs `calculateBatterySimulation` for every
 * (year, batterySize) pair and aggregates `selfConsumptionWithStorage` per
 * battery size as the mean across years. Caller supplies the hourly load
 * profile (8760h). PVGIS data is fetched per year via the existing adapter
 * (year passed through `startYear`/`endYear`).
 */
export async function simulateMultiYearSpeicherGrenz(
  params: SimulateMultiYearSpeicherGrenzParams
): Promise<SimulateMultiYearSpeicherGrenzResult> {
  const years = (params.years ?? DEFAULT_MULTI_YEAR_YEARS).slice();
  const batterySizes = (
    params.batterySizes ?? DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH
  ).slice();
  const spec = params.batterySpec ?? DEFAULT_BATTERY_SPEC;

  if (years.length === 0) {
    throw new Error("years must contain at least one year");
  }
  if (batterySizes.length === 0) {
    throw new Error("batterySizes must contain at least one size");
  }
  if (batterySizes.some((s) => !Number.isFinite(s) || s <= 0)) {
    throw new Error("batterySizes must contain only positive finite numbers");
  }

  const loadKwh = params.loadKwh;
  assertHourlyArray(loadKwh, "load");

  const yearly: Record<number, Record<number, number>> = {};

  let first = true;
  for (const year of years) {
    if (!first) await sleep(300);
    first = false;
    const pvProfile = await loadPVGISHourlyProfile({
      latitude: params.latitude,
      longitude: params.longitude,
      systemSizeKwP: params.pvSystemKwP,
      tiltDeg: params.tiltDeg,
      azimuthDeg: params.azimuthDeg,
      startYear: year,
      endYear: year,
    });
    if (pvProfile.length !== 8760) {
      throw new Error(
        `PV profile invalid after normalization: ${pvProfile.length}`
      );
    }

    const sizeMap: Record<number, number> = {};
    for (const size of batterySizes) {
      const result = calculateBatterySimulation(loadKwh, pvProfile, size, spec);
      sizeMap[size] = result.selfConsumptionWithStorage;
    }
    yearly[year] = sizeMap;
  }

  const average: Record<number, number> = {};
  for (const size of batterySizes) {
    let sum = 0;
    let count = 0;
    for (const year of years) {
      const v = yearly[year]?.[size];
      if (typeof v === "number" && Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    average[size] = count > 0 ? sum / count : 0;
  }

  return {
    batterySizes,
    yearly,
    average,
  };
}
