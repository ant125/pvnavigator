/**
 * Shared result types for the calculator UI.
 *
 * The former `calculateHouseholdConsumptionAction` server action was removed:
 * it ran the physics model without the account / access check and without
 * recording the report, which would have bypassed the PVNAVIGATOR_ access
 * rules. The only calculation entry point is `POST /api/calculate`.
 */
import type {
  HouseholdCalculationInput,
  HouseholdCalculationPayload,
} from "./runHouseholdCalculation";
import type { VerifiedResult } from "./verifiedResultStore.server";
import type { SpeicherGrenzPayload } from "@/lib/calculateSpeicherResult";
import type { WpuqRobustnessPayload } from "@/lib/wpuqRobustnessStats";

export type { VerifiedResult, SpeicherGrenzPayload, WpuqRobustnessPayload };
export type { HouseholdCalculationInput, HouseholdCalculationPayload };
export type { WwRobustnessPayload } from "@/lib/wpuqWwRobustnessStats";
