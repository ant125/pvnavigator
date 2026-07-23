"use server";

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
import type { PvSurfaceInput } from "../types/speicher";

export type { VerifiedResult, SpeicherGrenzPayload };

export type HouseholdCalculationPayload = {
  verifiedResult: VerifiedResult;
  speicherGrenz: SpeicherGrenzPayload;
  displayAddress: string;
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

function toGermanGeocodeError(error: unknown): Error {
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

export async function calculateHouseholdConsumptionAction(params: {
  annualConsumptionKWh: number;
  pvSystemKwP: number;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  tiltDeg: number;
  /** UI rooftop azimuth 0–359 (used when pvSurfaces absent/empty). */
  azimuthDeg: number;
  /** When non-empty: source of truth for PV; ignores scalars apart from totals kept in payload. */
  pvSurfaces?: readonly PvSurfaceInput[] | undefined;
  heatPumpEnabled?: boolean;
  heatPumpConsumptionKWh?: number;
  backupReserveKwh?: number;
}): Promise<HouseholdCalculationPayload> {
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

  const { verifiedResult, speicherGrenz } = await calculateSpeicherResult({
    annualConsumptionKWh: params.annualConsumptionKWh,
    pvSystemKwP: params.pvSystemKwP,
    latitude,
    longitude,
    tiltDeg: params.tiltDeg,
    azimuthDeg: params.azimuthDeg,
    pvSurfaces: params.pvSurfaces,
    heatPumpEnabled: params.heatPumpEnabled,
    heatPumpConsumptionKWh: params.heatPumpConsumptionKWh,
    backupReserveKwh: params.backupReserveKwh,
  });

  return {
    verifiedResult: setVerifiedResult(verifiedResult),
    speicherGrenz,
    displayAddress,
  };
}
