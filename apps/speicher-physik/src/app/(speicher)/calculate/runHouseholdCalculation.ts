import "server-only";

import { buildAddressString, geocodeAddress } from "@geocoding/core";
import {
  setVerifiedResult,
  type VerifiedResult,
} from "./verifiedResultStore.server";
import {
  calculateSpeicherResult,
  type SpeicherGrenzPayload,
} from "@/lib/calculateSpeicherResult";
import type { WpuqRobustnessPayload } from "@/lib/wpuqRobustnessStats";
import type { WwRobustnessPayload } from "@/lib/wpuqWwRobustnessStats";
import type { CalculationProgressHandler } from "@/lib/calculationProgress";
import type { PvSurfaceInput } from "../types/speicher";
import type {
  HeatPumpCalculationMeta,
  HeatPumpDhwService,
  HeatPumpTechnologyProduction,
} from "@/load/resolveHeatPumpLoadComponent";
import type {
  EvCalculationInput,
  EvCalculationMeta,
} from "@/load/resolveEvLoadComponent";

export type HouseholdCalculationPayload = {
  verifiedResult: VerifiedResult;
  speicherGrenz: SpeicherGrenzPayload;
  robustness: WpuqRobustnessPayload;
  /** Null unless production technology is Wasser/Wasser. */
  wasserWasserRobustness: WwRobustnessPayload | null;
  displayAddress: string;
  /** Resolved calculation metadata. Null when no heat-pump component was added. */
  heatPump: HeatPumpCalculationMeta | null;
  /** Per-weather-year EV metadata. Null when EV is absent/disabled. */
  ev: EvCalculationMeta | null;
};

function getGeocodeStatus(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "geocodeStatus" in error &&
    typeof (error as { geocodeStatus: unknown }).geocodeStatus === "string"
  ) {
    return (error as { geocodeStatus: string }).geocodeStatus;
  }

  return null;
}

export function toGermanGeocodeError(error: unknown): Error {
  const status = getGeocodeStatus(error);
  const message = error instanceof Error ? error.message : "";

  if (status === "ZERO_RESULTS") {
    return new Error(
      "Die Adresse konnte nicht gefunden werden. Bitte prüfen Sie Ihre Eingabe."
    );
  }

  if (status === "IMPRECISE_RESULT") {
    return new Error(
      "Die vollständige Adresse konnte nicht eindeutig gefunden werden. Bitte prüfen Sie Straße, Hausnummer, PLZ und Ort."
    );
  }

  if (status === "POSTAL_CODE_MISMATCH") {
    return new Error(
      "Die eingegebene PLZ stimmt nicht mit der gefundenen Adresse überein. Bitte prüfen Sie die PLZ."
    );
  }

  if (status === "INVALID_REQUEST") {
    return new Error("Bitte geben Sie eine vollständige Adresse ein.");
  }

  if (status === "REQUEST_DENIED" && message === "Server configuration error") {
    return new Error(
      "Die Geocodierung ist derzeit nicht verfügbar (Server-Konfiguration)."
    );
  }

  if (status === "UNKNOWN_ERROR" && message === "Geocoding request failed") {
    return new Error(
      "Die Adresse konnte nicht aufgelöst werden (Anfrage fehlgeschlagen). Bitte versuchen Sie es erneut."
    );
  }

  return new Error(
    "Die Adresse konnte nicht aufgelöst werden. Bitte versuchen Sie es erneut."
  );
}

export type HouseholdCalculationInput = {
  annualConsumptionKWh: number;
  pvSystemKwP: number;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  tiltDeg: number;
  azimuthDeg: number;
  pvSurfaces?: readonly PvSurfaceInput[] | undefined;
  heatPumpEnabled?: boolean;
  heatPumpConsumptionKWh?: number;
  heatPumpTechnology?: HeatPumpTechnologyProduction;
  heatPumpDhwService?: HeatPumpDhwService;
  ev?: EvCalculationInput;
  backupReserveKwh?: number;
};

/**
 * Same calculation as the server action. Optional onProgress is reporting only.
 */
export async function runHouseholdCalculation(
  params: HouseholdCalculationInput,
  onProgress?: CalculationProgressHandler
): Promise<HouseholdCalculationPayload> {
  const addressString = buildAddressString({
    street: params.street,
    houseNumber: params.houseNumber,
    postalCode: params.postalCode,
    city: params.city,
  });

  if (!addressString) {
    throw new Error("Bitte geben Sie eine vollständige Adresse ein.");
  }

  let latitude: number;
  let longitude: number;
  let displayAddress: string;

  try {
    const geocoded = await geocodeAddress(addressString, {
      requireExactAddress: true,
      expectedPostalCode: params.postalCode,
    });
    latitude = geocoded.latitude;
    longitude = geocoded.longitude;
    displayAddress = geocoded.formattedAddress || addressString;
  } catch (error) {
    throw toGermanGeocodeError(error);
  }

  await onProgress?.({ stage: "location" });

  const {
    verifiedResult,
    speicherGrenz,
    robustness,
    wasserWasserRobustness,
    heatPump,
    ev,
  } = await calculateSpeicherResult({
    annualConsumptionKWh: params.annualConsumptionKWh,
    pvSystemKwP: params.pvSystemKwP,
    latitude,
    longitude,
    tiltDeg: params.tiltDeg,
    azimuthDeg: params.azimuthDeg,
    pvSurfaces: params.pvSurfaces,
    heatPumpEnabled: params.heatPumpEnabled,
    heatPumpConsumptionKWh: params.heatPumpConsumptionKWh,
    heatPumpTechnology: params.heatPumpTechnology,
    heatPumpDhwService: params.heatPumpDhwService,
    ev: params.ev,
    backupReserveKwh: params.backupReserveKwh,
    onProgress,
  });

  return {
    verifiedResult: setVerifiedResult(verifiedResult),
    speicherGrenz,
    robustness,
    wasserWasserRobustness,
    displayAddress,
    heatPump,
    ev,
  };
}
