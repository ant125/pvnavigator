"use server";

import "server-only";
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
};

export async function calculateHouseholdConsumptionAction(params: {
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
}): Promise<HouseholdCalculationPayload> {
  const { verifiedResult, speicherGrenz } =
    await calculateSpeicherResult(params);

  return {
    verifiedResult: setVerifiedResult(verifiedResult),
    speicherGrenz,
  };
}
