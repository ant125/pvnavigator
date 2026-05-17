"use server";

import "server-only";
import {
  setVerifiedResult,
  type VerifiedResult,
} from "./verifiedResultStore.server";

export type { VerifiedResult };
import {
  createUserLoadProfileForYear,
} from "../../../../../../packages/bdew-profile";
import { loadPVGISHourlyProfile } from "../../../../../../packages/pvgis-adapter";
import { calculateEigenverbrauch } from "../../../../../../packages/pv-core";
import { simulateMultiYearSpeicherGrenz } from "@/lib/multiYearSimulation";
import { toPVGISAspect } from "@/lib/toPVGISAspect";
import { createHeatPumpComponent } from "@/load/heatpump";
import { mergeLoadProfiles, type LoadComponent } from "@/load/merge";

/** PVGIS + BDEW weekday calendar alignment for verified metrics and charts. */
const SPEICHER_VERIFIED_REFERENCE_YEAR = 2018;

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
  averageSocStartKwh: Record<number, number>;
  averageSocEndKwh: Record<number, number>;
  averageSocEndPct: Record<number, number>;
  averageEnergyBalanceErrorKwh: Record<number, number>;
  averageSelfDischargeLossKwh: Record<number, number>;
};

export type HouseholdCalculationPayload = {
  verifiedResult: VerifiedResult;
  speicherGrenz: SpeicherGrenzPayload;
};

export async function calculateHouseholdConsumptionAction(params: {
  annualConsumptionKWh: number;
  pvSystemKwP: number;
  latitude: number;
  longitude: number;
  tiltDeg: number;
  azimuthDeg: number;
  heatPumpEnabled?: boolean;
  heatPumpConsumptionKWh?: number;
  backupReserveKwh?: number;
}): Promise<HouseholdCalculationPayload> {
  const refYear = SPEICHER_VERIFIED_REFERENCE_YEAR;
  const loadKwh = buildMergedLoadForYear(
    refYear,
    params.annualConsumptionKWh,
    params.heatPumpEnabled,
    params.heatPumpConsumptionKWh
  );
  const pvgisAspectDeg = toPVGISAspect(params.azimuthDeg);
  const pvKwh = await loadPVGISHourlyProfile({
    latitude: params.latitude,
    longitude: params.longitude,
    systemSizeKwP: params.pvSystemKwP,
    tiltDeg: params.tiltDeg,
    azimuthDeg: pvgisAspectDeg,
    startYear: refYear,
    endYear: refYear,
  });

  const pvYieldKwhAnnual = pvKwh.reduce((sum, hour) => sum + hour, 0);

  const selfConsumptionWithoutStorage = calculateEigenverbrauch(
    loadKwh,
    pvKwh
  );

  const reserveKwh = params.backupReserveKwh ?? 0;
  const verifiedResult: VerifiedResult = {
    energy: {
      year: {
        selfConsumptionWithoutStorage,
        pvYieldKwhAnnual,
      },
    },
    ...(reserveKwh > 0 ? { backupReserveKwh: reserveKwh } : {}),
  };

  const multiYear = await simulateMultiYearSpeicherGrenz({
    getLoadForYear: (year) =>
      buildMergedLoadForYear(
        year,
        params.annualConsumptionKWh,
        params.heatPumpEnabled,
        params.heatPumpConsumptionKWh
      ),
    pvSystemKwP: params.pvSystemKwP,
    latitude: params.latitude,
    longitude: params.longitude,
    tiltDeg: params.tiltDeg,
    azimuthDeg: pvgisAspectDeg,
    backupReserveKwh: reserveKwh,
  });

  return {
    verifiedResult: setVerifiedResult(verifiedResult),
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
      averageSocStartKwh: multiYear.averageSocStartKwh,
      averageSocEndKwh: multiYear.averageSocEndKwh,
      averageSocEndPct: multiYear.averageSocEndPct,
      averageEnergyBalanceErrorKwh: multiYear.averageEnergyBalanceErrorKwh,
      averageSelfDischargeLossKwh: multiYear.averageSelfDischargeLossKwh,
    },
  };
}
