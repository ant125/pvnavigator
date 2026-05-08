"use server";

import "server-only";
import {
  setVerifiedResult,
  type VerifiedResult,
} from "./verifiedResultStore.server";

export type { VerifiedResult };
import { createUserLoadProfile } from "@bdew-profile/loader";
import { loadPVGISHourlyProfile } from "@pvgis-adapter/core";
import { calculateEigenverbrauch } from "@pv-core/calculations";
import { simulateMultiYearSpeicherGrenz } from "@/lib/multiYearSimulation";

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
}): Promise<HouseholdCalculationPayload> {
  const loadKwh = createUserLoadProfile(params.annualConsumptionKWh);
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

  const verifiedResult: VerifiedResult = {
    energy: {
      year: {
        selfConsumptionWithoutStorage,
      },
    },
  };

  const multiYear = await simulateMultiYearSpeicherGrenz({
    annualConsumptionKWh: params.annualConsumptionKWh,
    pvSystemKwP: params.pvSystemKwP,
    latitude: params.latitude,
    longitude: params.longitude,
    tiltDeg: params.tiltDeg,
    azimuthDeg: params.azimuthDeg,
  });

  return {
    verifiedResult: setVerifiedResult(verifiedResult),
    speicherGrenz: {
      batterySizes: multiYear.batterySizes,
      average: multiYear.average,
    },
  };
}
