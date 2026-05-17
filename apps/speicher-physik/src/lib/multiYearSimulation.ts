import "server-only";
import { loadPVGISHourlyProfile } from "../../../../packages/pvgis-adapter";
import {
  calculateBatterySimulation,
  DEFAULT_BATTERY_SPEC,
  type BatterySpec,
  type BatterySimulationResult,
} from "../../../../packages/pv-core";
import { toPVGISAspect } from "@/lib/toPVGISAspect";

const HOURS_PER_YEAR = 8760;

/** One roof PV plane for multi-roof (UI rooftop azimuth; converted internally for PVGIS). */
export type SpeicherPvSurfaceUi = {
  systemSizeKwP: number;
  tiltDeg: number;
  azimuthDeg: number;
};

/** Annual sums from `calculateBatterySimulation` used for multi-year averaging */
export type BatteryLedgerAnnual = Pick<
  BatterySimulationResult,
  | "directPvToHouseholdKwh"
  | "directPvToAuxiliaryKwh"
  | "batteryToHouseholdKwh"
  | "batteryToAuxiliaryKwh"
  | "gridToHouseholdKwh"
  | "gridToAuxiliaryKwh"
  | "gridExportKwh"
  | "auxiliaryConsumptionKwh"
  | "chargeLossKwh"
  | "dischargeLossKwh"
  | "chargeLossPvToBatteryKwh"
  | "chargeLossChemicalKwh"
  | "dischargeLossChemicalKwh"
  | "dischargeLossBatteryToAcKwh"
  | "socStartKwh"
  | "socEndKwh"
  | "socEndPct"
  | "energyBalanceErrorKwh"
  | "totalSelfDischargeLossKwh"
>;

function pickBatteryLedger(result: BatterySimulationResult): BatteryLedgerAnnual {
  return {
    directPvToHouseholdKwh: result.directPvToHouseholdKwh,
    directPvToAuxiliaryKwh: result.directPvToAuxiliaryKwh,
    batteryToHouseholdKwh: result.batteryToHouseholdKwh,
    batteryToAuxiliaryKwh: result.batteryToAuxiliaryKwh,
    gridToHouseholdKwh: result.gridToHouseholdKwh,
    gridToAuxiliaryKwh: result.gridToAuxiliaryKwh,
    gridExportKwh: result.gridExportKwh,
    auxiliaryConsumptionKwh: result.auxiliaryConsumptionKwh,
    chargeLossKwh: result.chargeLossKwh,
    dischargeLossKwh: result.dischargeLossKwh,
    chargeLossPvToBatteryKwh: result.chargeLossPvToBatteryKwh,
    chargeLossChemicalKwh: result.chargeLossChemicalKwh,
    dischargeLossChemicalKwh: result.dischargeLossChemicalKwh,
    dischargeLossBatteryToAcKwh: result.dischargeLossBatteryToAcKwh,
    socStartKwh: result.socStartKwh,
    socEndKwh: result.socEndKwh,
    socEndPct: result.socEndPct,
    energyBalanceErrorKwh: result.energyBalanceErrorKwh,
    totalSelfDischargeLossKwh: result.totalSelfDischargeLossKwh,
  };
}

function averageLedgerField<K extends keyof BatteryLedgerAnnual>(
  years: number[],
  batterySizes: number[],
  yearlyLedger: Record<number, Record<number, BatteryLedgerAnnual>>,
  field: K
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const size of batterySizes) {
    let sum = 0;
    let count = 0;
    for (const year of years) {
      const v = yearlyLedger[year]?.[size]?.[field];
      if (typeof v === "number" && Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    out[size] = count > 0 ? sum / count : 0;
  }
  return out;
}

export const DEFAULT_MULTI_YEAR_YEARS: ReadonlyArray<number> = [
  2016, 2017, 2018, 2019, 2020,
];

export const DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH: ReadonlyArray<number> =
  Array.from({ length: 26 }, (_, i) => i + 5);

export type SimulateMultiYearSpeicherGrenzParams = {
  /** Hourly load (8760h) for each simulated PV year — must match `years` rows. */
  getLoadForYear: (year: number) => number[];
  latitude: number;
  longitude: number;
  /**
   * When non-empty: one PVGIS call per roof surface per simulated year,
   * hourly PV summed before battery simulation (UI rooftop azimuth in `azimuthDeg`).
   * When omitted/empty (legacy single-roof): use `pvSystemKwP`, `tiltDeg`, `azimuthDeg`
   * where `azimuthDeg` must be the PVGIS `aspect`, not UI azimuth.
   */
  pvSurfaces?: readonly SpeicherPvSurfaceUi[];
  /** Legacy single-roof kWp — required when `pvSurfaces` is missing or empty */
  pvSystemKwP?: number;
  tiltDeg?: number;
  azimuthDeg?: number;
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
 * Hour-by-hour sum of several 8760h PVGIS profiles (must all be same length).
 */
export function sumHourlyProfiles(
  profiles: readonly (readonly number[])[]
): number[] {
  if (profiles.length === 0) {
    throw new Error("sumHourlyProfiles: at least one profile is required");
  }
  const n = profiles[0].length;
  for (let p = 1; p < profiles.length; p++) {
    if (profiles[p].length !== n) {
      throw new Error(
        `sumHourlyProfiles: hourly length mismatch (index 0 has ${n}h, index ${p} has ${profiles[p].length}h)`
      );
    }
  }
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let p = 0; p < profiles.length; p++) {
      sum += profiles[p][i];
    }
    out[i] = sum;
  }
  return out;
}

/** Fetch + combine hourly PV (8760 h) from PVGIS for one calendar year across roof surfaces (UI azimuth each). */
export async function loadCombinedHourlyPvForYear(
  latitude: number,
  longitude: number,
  year: number,
  surfaces: readonly SpeicherPvSurfaceUi[]
): Promise<number[]> {
  const profiles = await Promise.all(
    surfaces.map((s) =>
      loadPVGISHourlyProfile({
        latitude,
        longitude,
        systemSizeKwP: s.systemSizeKwP,
        tiltDeg: s.tiltDeg,
        azimuthDeg: toPVGISAspect(s.azimuthDeg),
        startYear: year,
        endYear: year,
      })
    )
  );
  return sumHourlyProfiles(profiles);
}

function legacySinglePvParams(params: SimulateMultiYearSpeicherGrenzParams): {
  pvSystemKwP: number;
  tiltDeg: number;
  azimuthPvAspectDeg: number;
} {
  const kw = params.pvSystemKwP;
  const tilt = params.tiltDeg;
  const aspect = params.azimuthDeg;
  if (typeof kw !== "number" || !Number.isFinite(kw)) {
    throw new Error(
      "simulateMultiYearSpeicherGrenz: pvSystemKwP is required when pvSurfaces is empty"
    );
  }
  if (typeof tilt !== "number" || !Number.isFinite(tilt)) {
    throw new Error(
      "simulateMultiYearSpeicherGrenz: tiltDeg is required when pvSurfaces is empty"
    );
  }
  if (typeof aspect !== "number" || !Number.isFinite(aspect)) {
    throw new Error(
      "simulateMultiYearSpeicherGrenz: azimuthDeg (PVGIS aspect) is required when pvSurfaces is empty"
    );
  }
  return {
    pvSystemKwP: kw,
    tiltDeg: tilt,
    azimuthPvAspectDeg: aspect,
  };
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

  const multiSurfaces =
    params.pvSurfaces && params.pvSurfaces.length > 0
      ? params.pvSurfaces.slice()
      : null;

  const yearly: Record<number, Record<number, number>> = {};
  const yearlyBatteryChargedKwh: Record<number, Record<number, number>> = {};
  const yearlyBatteryDischargedKwh: Record<number, Record<number, number>> =
    {};
  const yearlyBatteryLedger: Record<
    number,
    Record<number, BatteryLedgerAnnual>
  > = {};

  let first = true;
  for (const year of years) {
    if (!first) await sleep(300);
    first = false;

    let pvProfile: number[];
    if (multiSurfaces !== null && multiSurfaces.length > 0) {
      pvProfile = await loadCombinedHourlyPvForYear(
        params.latitude,
        params.longitude,
        year,
        multiSurfaces
      );
    } else {
      const { pvSystemKwP, tiltDeg, azimuthPvAspectDeg } =
        legacySinglePvParams(params);
      pvProfile = await loadPVGISHourlyProfile({
        latitude: params.latitude,
        longitude: params.longitude,
        systemSizeKwP: pvSystemKwP,
        tiltDeg: tiltDeg,
        azimuthDeg: azimuthPvAspectDeg,
        startYear: year,
        endYear: year,
      });
    }
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
    const ledgerMap: Record<number, BatteryLedgerAnnual> = {};
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
      ledgerMap[size] = pickBatteryLedger(result);
    }
    yearly[year] = sizeMap;
    yearlyBatteryChargedKwh[year] = chargedMap;
    yearlyBatteryDischargedKwh[year] = dischargedMap;
    yearlyBatteryLedger[year] = ledgerMap;
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

  const averageDirectPvToHouseholdKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "directPvToHouseholdKwh"
  );
  const averageDirectPvToAuxiliaryKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "directPvToAuxiliaryKwh"
  );
  const averageBatteryToHouseholdKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "batteryToHouseholdKwh"
  );
  const averageBatteryToAuxiliaryKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "batteryToAuxiliaryKwh"
  );
  const averageGridToHouseholdKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "gridToHouseholdKwh"
  );
  const averageGridToAuxiliaryKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "gridToAuxiliaryKwh"
  );
  const averageGridExportKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "gridExportKwh"
  );
  const averageAuxiliaryConsumptionKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "auxiliaryConsumptionKwh"
  );
  const averageChargeLossKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "chargeLossKwh"
  );
  const averageDischargeLossKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "dischargeLossKwh"
  );
  const averageChargeLossPvToBatteryKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "chargeLossPvToBatteryKwh"
  );
  const averageChargeLossChemicalKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "chargeLossChemicalKwh"
  );
  const averageDischargeLossChemicalKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "dischargeLossChemicalKwh"
  );
  const averageDischargeLossBatteryToAcKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "dischargeLossBatteryToAcKwh"
  );
  const averageSocStartKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "socStartKwh"
  );
  const averageSocEndKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "socEndKwh"
  );
  const averageSocEndPct = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "socEndPct"
  );
  const averageEnergyBalanceErrorKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "energyBalanceErrorKwh"
  );
  const averageSelfDischargeLossKwh = averageLedgerField(
    years,
    batterySizes,
    yearlyBatteryLedger,
    "totalSelfDischargeLossKwh"
  );

  return {
    batterySizes,
    yearly,
    average,
    averageBatteryChargedKwh,
    averageBatteryDischargedKwh,
    averageDirectPvToHouseholdKwh,
    averageDirectPvToAuxiliaryKwh,
    averageBatteryToHouseholdKwh,
    averageBatteryToAuxiliaryKwh,
    averageGridToHouseholdKwh,
    averageGridToAuxiliaryKwh,
    averageGridExportKwh,
    averageAuxiliaryConsumptionKwh,
    averageChargeLossKwh,
    averageDischargeLossKwh,
    averageChargeLossPvToBatteryKwh,
    averageChargeLossChemicalKwh,
    averageDischargeLossChemicalKwh,
    averageDischargeLossBatteryToAcKwh,
    averageSocStartKwh,
    averageSocEndKwh,
    averageSocEndPct,
    averageEnergyBalanceErrorKwh,
    averageSelfDischargeLossKwh,
  };
}
