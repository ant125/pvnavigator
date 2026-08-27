import "server-only";

import { createUserLoadProfileForYear } from "../../../../packages/bdew-profile";
import { simulateMultiYearSpeicherGrenz } from "@/lib/multiYearSimulation";
import { createHeatPumpComponent } from "@/load/heatpump";
import { mergeLoadProfiles, type LoadComponent } from "@/load/merge";
import type { PvSurfaceInput } from "@/app/(speicher)/types/speicher";

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
  };
  speicherGrenz: SpeicherGrenzPayload;
};

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

  const multiYear = await simulateMultiYearSpeicherGrenz({
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
  });

  const verifiedResult: CalculateSpeicherResultOutput["verifiedResult"] = {
    energy: {
      year: {
        selfConsumptionWithoutStorage:
          multiYear.averageSelfConsumptionWithoutStorageKwh,
        pvYieldKwhAnnual: multiYear.averagePvYieldKwhAnnual,
      },
    },
    ...(reserveKwh > 0 ? { backupReserveKwh: reserveKwh } : {}),
  };

  return {
    verifiedResult,
    speicherGrenz: {
      batterySizes: multiYear.batterySizes,
      average: multiYear.average,
      averageBatteryChargedKwh: multiYear.averageBatteryChargedKwh,
      averageBatteryDischargedKwh: multiYear.averageBatteryDischargedKwh,
      averageDirectPvToHouseholdKwh: multiYear.averageDirectPvToHouseholdKwh,
      averageDirectPvToAuxiliaryKwh: multiYear.averageDirectPvToAuxiliaryKwh,
      averageBatteryToHouseholdKwh: multiYear.averageBatteryToHouseholdKwh,
      averageBatteryToAuxiliaryKwh: multiYear.averageBatteryToAuxiliaryKwh,
      averageGridToHouseholdKwh: multiYear.averageGridToHouseholdKwh,
      averageGridToAuxiliaryKwh: multiYear.averageGridToAuxiliaryKwh,
      averageGridExportKwh: multiYear.averageGridExportKwh,
      averageAuxiliaryConsumptionKwh: multiYear.averageAuxiliaryConsumptionKwh,
      averageChargeLossKwh: multiYear.averageChargeLossKwh,
      averageDischargeLossKwh: multiYear.averageDischargeLossKwh,
      averageChargeLossPvToBatteryKwh: multiYear.averageChargeLossPvToBatteryKwh,
      averageChargeLossChemicalKwh: multiYear.averageChargeLossChemicalKwh,
      averageDischargeLossChemicalKwh: multiYear.averageDischargeLossChemicalKwh,
      averageDischargeLossBatteryToAcKwh:
        multiYear.averageDischargeLossBatteryToAcKwh,
      averageSocStartKwh: multiYear.averageSocStartKwh,
      averageSocEndKwh: multiYear.averageSocEndKwh,
      averageSocEndPct: multiYear.averageSocEndPct,
      averageEnergyBalanceErrorKwh: multiYear.averageEnergyBalanceErrorKwh,
      averageSelfDischargeLossKwh: multiYear.averageSelfDischargeLossKwh,
      averageSelfConsumptionWithoutStorageKwh:
        multiYear.averageSelfConsumptionWithoutStorageKwh,
      averagePvYieldKwhAnnual: multiYear.averagePvYieldKwhAnnual,
      averageLoadKwhAnnual: multiYear.averageLoadKwhAnnual,
    },
  };
}
