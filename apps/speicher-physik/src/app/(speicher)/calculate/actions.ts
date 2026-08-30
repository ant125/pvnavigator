"use server";

import "server-only";
import {
  runHouseholdCalculation,
  type HouseholdCalculationInput,
  type HouseholdCalculationPayload,
} from "./runHouseholdCalculation";
import type { VerifiedResult } from "./verifiedResultStore.server";
import type { SpeicherGrenzPayload } from "@/lib/calculateSpeicherResult";
import type { WpuqRobustnessPayload } from "@/lib/wpuqRobustnessStats";

export type { VerifiedResult, SpeicherGrenzPayload, WpuqRobustnessPayload };
export type { HouseholdCalculationPayload };

export async function calculateHouseholdConsumptionAction(
  params: HouseholdCalculationInput
): Promise<HouseholdCalculationPayload> {
  return runHouseholdCalculation(params);
}
