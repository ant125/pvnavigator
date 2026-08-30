import "server-only";

import { createUserLoadProfile15MinForYear } from "../../../../packages/bdew-profile";
import {
  adaptPvToTimeStep,
  DEFAULT_MULTI_YEAR_YEARS,
  DEFAULT_WEATHER_DATABASE,
  loadHourlyPvByYear,
  simulateMultiYearSpeicherGrenz,
} from "@/lib/multiYearSimulation";
import { createHeatPumpComponent15Min } from "@/load/heatpump";
import { mergeLoadProfiles, type LoadComponent } from "@/load/merge";
import type { PvSurfaceInput } from "@/app/(speicher)/types/speicher";
import { buildSpeicherChartData } from "@/lib/speicherChartData";
import { deriveRecommendedTechnicalSize } from "@/lib/speicherRecommendation";
import { runWpuqHouseholdRobustness } from "@/lib/wpuqRobustness";
import type { WpuqRobustnessPayload } from "@/lib/wpuqRobustnessStats";
import type { CalculationProgressHandler } from "@/lib/calculationProgress";
import {
  BATTERY_MODEL_VERSION,
  TIME_STEP_HOURS_15,
  type PhysicalKernelResult,
} from "../../../../packages/pv-core";

/** Production load: native BDEW H25 15-min + optional 15-min Wärmepumpe. */
function buildMergedLoadForYear(
  year: number,
  annualConsumptionKWh: number,
  heatPumpEnabled: boolean | undefined,
  heatPumpConsumptionKWh: number | undefined
): number[] {
  const houseLoad = createUserLoadProfile15MinForYear(
    annualConsumptionKWh,
    year
  );

  const components: LoadComponent[] = [
    {
      name: "house",
      yearlyConsumption: annualConsumptionKWh,
      profile: houseLoad,
    },
  ];

  if (
    heatPumpEnabled === true &&
    typeof heatPumpConsumptionKWh === "number" &&
    heatPumpConsumptionKWh > 0
  ) {
    components.push(createHeatPumpComponent15Min(heatPumpConsumptionKWh));
  }

  return mergeLoadProfiles(components);
}

function normalizePvSurfacesForSpeicherAction(params: {
  pvSurfaces?: readonly PvSurfaceInput[] | undefined;
  pvSystemKwP: number;
  tiltDeg: number;
  /** UI rooftop azimuth 0–359 */
  azimuthDeg: number;
}): PvSurfaceInput[] {
  if (
    params.pvSurfaces &&
    Array.isArray(params.pvSurfaces) &&
    params.pvSurfaces.length > 0
  ) {
    return params.pvSurfaces.map((s) => ({
      systemSizeKwP: s.systemSizeKwP,
      tiltDeg: s.tiltDeg,
      azimuthDeg: s.azimuthDeg,
    }));
  }
  return [
    {
      systemSizeKwP: params.pvSystemKwP,
      tiltDeg: params.tiltDeg,
      azimuthDeg: params.azimuthDeg,
    },
  ];
}

export type SpeicherGrenzPayload = {
  batterySizes: number[];
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
  batteryModelVersion: typeof BATTERY_MODEL_VERSION;
};

export type CalculateSpeicherResultInput = {
  annualConsumptionKWh: number;
  pvSystemKwP: number;
  latitude: number;
  longitude: number;
  tiltDeg: number;
  /** UI rooftop azimuth 0–359 (used when pvSurfaces absent/empty). */
  azimuthDeg: number;
  /** When non-empty: source of truth for PV; ignores scalars apart from totals kept in payload. */
  pvSurfaces?: readonly PvSurfaceInput[] | undefined;
  heatPumpEnabled?: boolean;
  heatPumpConsumptionKWh?: number;
  backupReserveKwh?: number;
  /**
   * Test-only: skip PVGIS. Production omits this so PV is fetched once
   * and reused for BDEW plus the 27 WPuQ robustness runs.
   */
  getPvForYear?: (year: number) => number[] | Promise<number[]>;
  years?: readonly number[];
  batterySizes?: readonly number[];
  /** Optional progress reporting. Does not change results. */
  onProgress?: CalculationProgressHandler;
};

export type CalculateSpeicherResultOutput = {
  verifiedResult: {
    energy: {
      year: {
        selfConsumptionWithoutStorage: number;
        pvYieldKwhAnnual: number;
      };
    };
    backupReserveKwh?: number;
    batteryModelVersion: typeof BATTERY_MODEL_VERSION;
  };
  speicherGrenz: SpeicherGrenzPayload;
  robustness: WpuqRobustnessPayload;
};

/**
 * Compact UI payload from the internal kernel. Omits yearly ledgers,
 * hourly series, and kernel metadata so the free SpeicherGrenze response
 * stays small. The kernel itself is not returned to the browser.
 */
export function toSpeicherGrenzPayload(
  kernel: PhysicalKernelResult
): SpeicherGrenzPayload {
  return {
    batterySizes: kernel.batterySizes,
    average: kernel.average,
    averageBatteryChargedKwh: kernel.averageBatteryChargedKwh,
    averageBatteryDischargedKwh: kernel.averageBatteryDischargedKwh,
    averageDirectPvToHouseholdKwh: kernel.averageDirectPvToHouseholdKwh,
    averageDirectPvToAuxiliaryKwh: kernel.averageDirectPvToAuxiliaryKwh,
    averageBatteryToHouseholdKwh: kernel.averageBatteryToHouseholdKwh,
    averageBatteryToAuxiliaryKwh: kernel.averageBatteryToAuxiliaryKwh,
    averageGridToHouseholdKwh: kernel.averageGridToHouseholdKwh,
    averageGridToAuxiliaryKwh: kernel.averageGridToAuxiliaryKwh,
    averageGridExportKwh: kernel.averageGridExportKwh,
    averageAuxiliaryConsumptionKwh: kernel.averageAuxiliaryConsumptionKwh,
    averageChargeLossKwh: kernel.averageChargeLossKwh,
    averageDischargeLossKwh: kernel.averageDischargeLossKwh,
    averageChargeLossPvToBatteryKwh: kernel.averageChargeLossPvToBatteryKwh,
    averageChargeLossChemicalKwh: kernel.averageChargeLossChemicalKwh,
    averageDischargeLossChemicalKwh: kernel.averageDischargeLossChemicalKwh,
    averageDischargeLossBatteryToAcKwh:
      kernel.averageDischargeLossBatteryToAcKwh,
    averageSocStartKwh: kernel.averageSocStartKwh,
    averageSocEndKwh: kernel.averageSocEndKwh,
    averageSocEndPct: kernel.averageSocEndPct,
    averageEnergyBalanceErrorKwh: kernel.averageEnergyBalanceErrorKwh,
    averageSelfDischargeLossKwh: kernel.averageSelfDischargeLossKwh,
    averageSelfConsumptionWithoutStorageKwh:
      kernel.averageSelfConsumptionWithoutStorageKwh,
    averagePvYieldKwhAnnual: kernel.averagePvYieldKwhAnnual,
    averageLoadKwhAnnual: kernel.averageLoadKwhAnnual,
    batteryModelVersion: kernel.batteryModelVersion,
  };
}

export async function calculateSpeicherResult(
  input: CalculateSpeicherResultInput
): Promise<CalculateSpeicherResultOutput> {
  const pvSurfaces = normalizePvSurfacesForSpeicherAction({
    pvSurfaces: input.pvSurfaces,
    pvSystemKwP: input.pvSystemKwP,
    tiltDeg: input.tiltDeg,
    azimuthDeg: input.azimuthDeg,
  });

  const reserveKwh = input.backupReserveKwh ?? 0;
  const years = (input.years ?? DEFAULT_MULTI_YEAR_YEARS).slice();
  const report = input.onProgress;

  let getPvForYear = input.getPvForYear;
  if (!getPvForYear) {
    const hourlyByYear = await loadHourlyPvByYear({
      latitude: input.latitude,
      longitude: input.longitude,
      years,
      pvSurfaces,
    });
    const pv15ByYear: Record<number, number[]> = {};
    for (const year of years) {
      const hourly = hourlyByYear[year];
      if (!hourly) {
        throw new Error(`Missing prefetched PV profile for year ${year}`);
      }
      pv15ByYear[year] = adaptPvToTimeStep(hourly, TIME_STEP_HOURS_15);
    }
    getPvForYear = (year: number) => {
      const profile = pv15ByYear[year];
      if (!profile) {
        throw new Error(`Missing expanded PV profile for year ${year}`);
      }
      return profile;
    };
  }
  await report?.({ stage: "pvgis" });

  const loadByYear: Record<number, number[]> = {};
  for (const year of years) {
    loadByYear[year] = buildMergedLoadForYear(
      year,
      input.annualConsumptionKWh,
      input.heatPumpEnabled,
      input.heatPumpConsumptionKWh
    );
  }
  await report?.({ stage: "consumption" });

  const kernel = await simulateMultiYearSpeicherGrenz({
    getLoadForYear: (year) => loadByYear[year],
    getPvForYear,
    latitude: input.latitude,
    longitude: input.longitude,
    pvSurfaces: pvSurfaces,
    years,
    batterySizes: input.batterySizes,
    backupReserveKwh: reserveKwh,
    includeHourly: false,
    timeStepHours: TIME_STEP_HOURS_15,
    weatherDatabase: DEFAULT_WEATHER_DATABASE,
  });
  await report?.({ stage: "physics" });

  const bdewChart = buildSpeicherChartData({
    selfConsumptionWithoutStorage:
      kernel.averageSelfConsumptionWithoutStorageKwh,
    batterySizes: kernel.batterySizes,
    average: kernel.average,
  });
  const bdewTechnicalSizeKwh = deriveRecommendedTechnicalSize({
    data: bdewChart.data,
  });

  const robustness = await runWpuqHouseholdRobustness({
    householdAnnualKwh: input.annualConsumptionKWh,
    heatPumpEnabled: input.heatPumpEnabled,
    heatPumpConsumptionKWh: input.heatPumpConsumptionKWh,
    getPvForYear,
    bdewTechnicalSizeKwh,
    years,
    batterySizes: input.batterySizes,
    backupReserveKwh: reserveKwh,
    onHouseholdComplete: async (completed, total) => {
      await report?.({ stage: "smartmeter", completed, total });
    },
  });

  const verifiedResult: CalculateSpeicherResultOutput["verifiedResult"] = {
    energy: {
      year: {
        selfConsumptionWithoutStorage:
          kernel.averageSelfConsumptionWithoutStorageKwh,
        pvYieldKwhAnnual: kernel.averagePvYieldKwhAnnual,
      },
    },
    batteryModelVersion: kernel.batteryModelVersion,
    ...(reserveKwh > 0 ? { backupReserveKwh: reserveKwh } : {}),
  };

  return {
    verifiedResult,
    speicherGrenz: toSpeicherGrenzPayload(kernel),
    robustness,
  };
}
