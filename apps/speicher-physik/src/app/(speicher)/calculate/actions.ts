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

  const verifiedResult: VerifiedResult = {
    energy: {
      year: {
        selfConsumptionWithoutStorage,
      },
    },
  };

  const multiYear = await simulateMultiYearSpeicherGrenz({
    loadKwh,
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
