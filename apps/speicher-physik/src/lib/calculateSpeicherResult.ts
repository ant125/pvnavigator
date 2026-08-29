import "server-only";

import { createUserLoadProfileForYear } from "../../../../packages/bdew-profile";
import { simulateMultiYearSpeicherGrenz } from "@/lib/multiYearSimulation";
import { createHeatPumpComponent } from "@/load/heatpump";
import { mergeLoadProfiles, type LoadComponent } from "@/load/merge";
import type { PvSurfaceInput } from "@/app/(speicher)/types/speicher";
import {
  BATTERY_MODEL_VERSION,
  type PhysicalKernelResult,
} from "../../../../packages/pv-core";

function buildMergedLoadForYear(
  year: number,
  annualConsumptionKWh: number,
  heatPumpEnabled: boolean | undefined,
  heatPumpConsumptionKWh: number | undefined
): number[] {
  const houseLoad = createUserLoadProfileForYear(annualConsumptionKWh, year);

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
    components.push(createHeatPumpComponent(heatPumpConsumptionKWh));
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

  const kernel = await simulateMultiYearSpeicherGrenz({
    getLoadForYear: (year) =>
      buildMergedLoadForYear(
        year,
        input.annualConsumptionKWh,
        input.heatPumpEnabled,
        input.heatPumpConsumptionKWh
      ),
    latitude: input.latitude,
    longitude: input.longitude,
    pvSurfaces: pvSurfaces,
    backupReserveKwh: reserveKwh,
    includeHourly: false,
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
  };
}
