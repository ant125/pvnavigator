"use server";

import "server-only";
import {
  setVerifiedResult,
  type VerifiedResult,
} from "./verifiedResultStore.server";

export type { VerifiedResult };
import { createUserLoadProfile } from "../../../../../../packages/bdew-profile";
import { loadPVGISHourlyProfile } from "../../../../../../packages/pvgis-adapter";
import { calculateEigenverbrauch } from "../../../../../../packages/pv-core";
import { simulateMultiYearSpeicherGrenz } from "@/lib/multiYearSimulation";
import { createHeatPumpComponent } from "@/load/heatpump";
import { mergeLoadProfiles } from "@/load/merge";

export type SpeicherGrenzPayload = {
  batterySizes: number[];
  average: Record<number, number>;
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
  const houseLoad = createUserLoadProfile(params.annualConsumptionKWh);

  const components = [
    {
      name: "house",
      yearlyConsumption: params.annualConsumptionKWh,
      profile: houseLoad,
    },
  ];

  if (
    params.heatPumpEnabled &&
    typeof params.heatPumpConsumptionKWh === "number" &&
    params.heatPumpConsumptionKWh > 0
  ) {
    components.push(createHeatPumpComponent(params.heatPumpConsumptionKWh));
  }

  const loadKwh = mergeLoadProfiles(components);
  const pvKwh = await loadPVGISHourlyProfile({
    latitude: params.latitude,
    longitude: params.longitude,
    systemSizeKwP: params.pvSystemKwP,
    tiltDeg: params.tiltDeg,
    azimuthDeg: params.azimuthDeg,
  });

  const selfConsumptionWithoutStorage = calculateEigenverbrauch(
    loadKwh,
    pvKwh
  );

  const reserveKwh = params.backupReserveKwh ?? 0;
  const verifiedResult: VerifiedResult = {
    energy: {
      year: {
        selfConsumptionWithoutStorage,
      },
    },
    ...(reserveKwh > 0 ? { backupReserveKwh: reserveKwh } : {}),
  };

  const multiYear = await simulateMultiYearSpeicherGrenz({
    loadKwh,
    pvSystemKwP: params.pvSystemKwP,
    latitude: params.latitude,
    longitude: params.longitude,
    tiltDeg: params.tiltDeg,
    azimuthDeg: params.azimuthDeg,
    backupReserveKwh: reserveKwh,
  });

  return {
    verifiedResult: setVerifiedResult(verifiedResult),
    speicherGrenz: {
      batterySizes: multiYear.batterySizes,
      average: multiYear.average,
    },
  };
}
