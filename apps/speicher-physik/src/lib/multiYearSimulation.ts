import "server-only";
import { loadPVGISHourlyProfile } from "../../../../packages/pvgis-adapter";
import {
  calculateBatterySimulation,
  DEFAULT_BATTERY_SPEC,
  type BatterySpec,
} from "../../../../packages/pv-core";

const HOURS_PER_YEAR = 8760;

export const DEFAULT_MULTI_YEAR_YEARS: ReadonlyArray<number> = [
  2016, 2017, 2018, 2019, 2020,
];

export const DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH: ReadonlyArray<number> =
  Array.from({ length: 26 }, (_, i) => i + 5);

export type SimulateMultiYearSpeicherGrenzParams = {
  /** Hourly load (8760h) for each simulated PV year — must match `years` rows. */
  getLoadForYear: (year: number) => number[];
  pvSystemKwP: number;
  latitude: number;
  longitude: number;
  tiltDeg: number;
  azimuthDeg: number;
  years?: ReadonlyArray<number>;
  batterySizes?: ReadonlyArray<number>;
  batterySpec?: BatterySpec;
  backupReserveKwh?: number;
};

export type SimulateMultiYearSpeicherGrenzResult = {
  batterySizes: number[];
  yearly: Record<number, Record<number, number>>;
  average: Record<number, number>;
  averageBatteryChargedKwh: Record<number, number>;
  averageBatteryDischargedKwh: Record<number, number>;
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
 * battery size as the mean across years. Also averages `totalChargedKwh` and
 * `totalDischargedKwh` from the same runs. Caller supplies `getLoadForYear`
 * so the load calendar matches each PVGIS `year`. PVGIS data is fetched per
 * year via the existing adapter (year passed through `startYear`/`endYear`).
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

  const yearly: Record<number, Record<number, number>> = {};
  const yearlyBatteryChargedKwh: Record<number, Record<number, number>> = {};
  const yearlyBatteryDischargedKwh: Record<number, Record<number, number>> =
    {};

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

    const loadKwhYear = params.getLoadForYear(year);
    assertHourlyArray(loadKwhYear, `load year ${year}`);

    const sizeMap: Record<number, number> = {};
    const chargedMap: Record<number, number> = {};
    const dischargedMap: Record<number, number> = {};
    for (const size of batterySizes) {
      const result = calculateBatterySimulation(
        loadKwhYear,
        pvProfile,
        size,
        spec,
        params.backupReserveKwh ?? 0
      );
      sizeMap[size] = result.selfConsumptionWithStorage;
      chargedMap[size] = result.totalChargedKwh;
      dischargedMap[size] = result.totalDischargedKwh;
    }
    yearly[year] = sizeMap;
    yearlyBatteryChargedKwh[year] = chargedMap;
    yearlyBatteryDischargedKwh[year] = dischargedMap;
  }

  const average: Record<number, number> = {};
  const averageBatteryChargedKwh: Record<number, number> = {};
  const averageBatteryDischargedKwh: Record<number, number> = {};
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

    let sumCharged = 0;
    let countCharged = 0;
    for (const year of years) {
      const v = yearlyBatteryChargedKwh[year]?.[size];
      if (typeof v === "number" && Number.isFinite(v)) {
        sumCharged += v;
        countCharged += 1;
      }
    }
    averageBatteryChargedKwh[size] =
      countCharged > 0 ? sumCharged / countCharged : 0;

    let sumDischarged = 0;
    let countDischarged = 0;
    for (const year of years) {
      const v = yearlyBatteryDischargedKwh[year]?.[size];
      if (typeof v === "number" && Number.isFinite(v)) {
        sumDischarged += v;
        countDischarged += 1;
      }
    }
    averageBatteryDischargedKwh[size] =
      countDischarged > 0 ? sumDischarged / countDischarged : 0;
  }

  return {
    batterySizes,
    yearly,
    average,
    averageBatteryChargedKwh,
    averageBatteryDischargedKwh,
  };
}
