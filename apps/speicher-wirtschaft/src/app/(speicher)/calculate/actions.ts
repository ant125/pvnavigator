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

export type HouseholdCalculationPayload = {
  verifiedResult: VerifiedResult;
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

  return {
    verifiedResult: setVerifiedResult(verifiedResult),
  };
}
