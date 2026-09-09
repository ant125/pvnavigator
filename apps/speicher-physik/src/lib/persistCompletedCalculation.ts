import type { HouseholdCalculationInput } from "@/app/(speicher)/calculate/runHouseholdCalculation";
import type { HouseholdCalculationPayload } from "@/app/(speicher)/calculate/runHouseholdCalculation";
import { deriveSpeicherBusinessMetrics } from "@/lib/deriveSpeicherBusinessMetrics";

export const SPEICHER_GRENZE_PRODUCT_KEY = "speicher_grenze";
export const SPEICHER_GRENZE_INPUT_SCHEMA_VERSION = "speicher-grenze-input/v1";
export const SPEICHER_GRENZE_RESULT_SCHEMA_VERSION_V1 =
  "speicher-grenze-result/v1";
export const SPEICHER_GRENZE_RESULT_SCHEMA_VERSION = "speicher-grenze-result/v2";

export type FrozenSpeicherPresentation = {
  recommendedTechnicalSize: number;
  recommendedPlanningSize: number;
};

export type CompletedCalculationInsert = {
  user_id: string;
  product_key: string;
  name: string;
  input: Record<string, unknown>;
  result_snapshot: Record<string, unknown>;
  input_schema_version: string;
  result_schema_version: string;
  battery_model_version: string;
  summary_address: string | null;
  summary_pv_kwp: number;
  summary_consumption_kwh: number;
};

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function calculationName(displayAddress: string): string {
  const trimmed = displayAddress.trim();
  return trimmed.length > 0 ? trimmed : "SpeicherGrenze";
}

function evEnabledFromInput(input: HouseholdCalculationInput): boolean {
  return input.ev?.enabled === true;
}

export function freezeSpeicherPresentation(args: {
  input: HouseholdCalculationInput;
  payload: HouseholdCalculationPayload;
}): FrozenSpeicherPresentation {
  const metrics = deriveSpeicherBusinessMetrics({
    verifiedResult: args.payload.verifiedResult,
    speicherGrenz: args.payload.speicherGrenz,
    annualConsumptionKwh: args.input.annualConsumptionKWh,
    heatPumpEnabled: args.input.heatPumpEnabled,
    heatPumpConsumptionKwh: args.input.heatPumpConsumptionKWh,
    evEnabled: evEnabledFromInput(args.input),
    evAverageHomeChargedKwh: args.payload.ev?.averageHomeChargedKwh,
    backupReserveKwh: args.input.backupReserveKwh,
    totalKwPConfigured: args.input.pvSystemKwP,
  });
  return {
    recommendedTechnicalSize: metrics.recommendedTechnicalSize,
    recommendedPlanningSize: metrics.recommendedPlanningSize,
  };
}

/**
 * Canonical input + compact result for public.calculations.
 * Does not include 15-minute or hourly kernel series.
 */
export function mapCompletedCalculation(args: {
  userId: string;
  input: HouseholdCalculationInput;
  payload: HouseholdCalculationPayload;
}): CompletedCalculationInsert {
  const { userId, input, payload } = args;
  const summaryAddress = payload.displayAddress.trim() || null;
  const presentation = freezeSpeicherPresentation({ input, payload });

  return {
    user_id: userId,
    product_key: SPEICHER_GRENZE_PRODUCT_KEY,
    name: calculationName(payload.displayAddress),
    input: jsonClone({
      annualConsumptionKWh: input.annualConsumptionKWh,
      pvSystemKwP: input.pvSystemKwP,
      street: input.street,
      houseNumber: input.houseNumber,
      postalCode: input.postalCode,
      city: input.city,
      tiltDeg: input.tiltDeg,
      azimuthDeg: input.azimuthDeg,
      pvSurfaces: input.pvSurfaces,
      heatPumpEnabled: input.heatPumpEnabled,
      heatPumpConsumptionKWh: input.heatPumpConsumptionKWh,
      heatPumpTechnology: input.heatPumpTechnology,
      heatPumpDhwService: input.heatPumpDhwService,
      ev: input.ev,
      backupReserveKwh: input.backupReserveKwh,
      displayAddress: payload.displayAddress,
    }),
    result_snapshot: jsonClone({
      verifiedResult: payload.verifiedResult,
      speicherGrenz: payload.speicherGrenz,
      robustness: payload.robustness,
      wasserWasserRobustness: payload.wasserWasserRobustness,
      heatPump: payload.heatPump,
      ev: payload.ev,
      displayAddress: payload.displayAddress,
      presentation,
    }),
    input_schema_version: SPEICHER_GRENZE_INPUT_SCHEMA_VERSION,
    result_schema_version: SPEICHER_GRENZE_RESULT_SCHEMA_VERSION,
    battery_model_version: payload.verifiedResult.batteryModelVersion,
    summary_address: summaryAddress,
    summary_pv_kwp: input.pvSystemKwP,
    summary_consumption_kwh: input.annualConsumptionKWh,
  };
}

export async function persistCompletedCalculation(args: {
  userId: string;
  input: HouseholdCalculationInput;
  payload: HouseholdCalculationPayload;
}): Promise<void> {
  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const supabase = await createServerSupabaseClient();
    const row = mapCompletedCalculation(args);
    const { error } = await supabase.from("calculations").insert(row);
    if (error) {
      console.error("Failed to persist completed calculation", error);
    }
  } catch (error) {
    console.error("Failed to persist completed calculation", error);
  }
}
