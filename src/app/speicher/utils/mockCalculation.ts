/**
 * Mock Calculation Utilities for Speicher Module
 *
 * IMPORTANT: These are placeholder calculations for MVP/demo purposes.
 * Real calculations will be implemented in a future iteration.
 *
 * The mock results are designed to be plausible and educational,
 * showing users what kind of analysis they can expect.
 */

import {
  SpeicherInput,
  SpeicherResult,
  ECONOMIC_PARAMS,
} from "../types/speicher";

/**
 * Generate mock calculation results
 *
 * NOTE: This is NOT a real calculation!
 * It produces plausible-looking results for demo purposes.
 *
 * Real implementation will need:
 * - Actual irradiance data for location
 * - Load profile simulation
 * - Battery charge/discharge optimization
 * - Financial NPV calculation
 */
export function calculateMockResult(input: SpeicherInput): SpeicherResult {
  // Derive some "reasonable" values from input
  const { pvSizeKwp, annualConsumptionKwh } = input;

  // Mock: Estimate annual PV generation (simplified)
  // Real calculation would use location-specific irradiance
  const annualPvGenerationKwh = pvSizeKwp * 950; // ~950 kWh/kWp for Germany avg

  // Mock: Self-consumption without battery
  // Typically 25-40% for residential without battery
  const baseRatio = annualPvGenerationKwh / annualConsumptionKwh;
  const selfConsumptionWithout = Math.min(35, 20 + baseRatio * 10);

  // Mock: Recommended battery size
  // Rule of thumb: ~1 kWh per 1 kWp, adjusted by consumption
  const consumptionFactor = annualConsumptionKwh / 4000; // normalize to 4000 kWh
  const recommendedSizeKwh =
    Math.round(Math.min(15, Math.max(5, pvSizeKwp * consumptionFactor)) * 2) / 2;

  // Mock: Self-consumption with battery
  // Typically increases by 20-35% with appropriately sized battery
  const selfConsumptionWith = Math.min(
    75,
    selfConsumptionWithout + 25 + (recommendedSizeKwh / pvSizeKwp) * 5
  );

  // Mock: Calculate savings
  const additionalSelfConsumption =
    (selfConsumptionWith - selfConsumptionWithout) / 100;
  const savedEnergyKwh = annualPvGenerationKwh * additionalSelfConsumption;
  const savingsPerKwh =
    ECONOMIC_PARAMS.electricityPriceEurKwh -
    ECONOMIC_PARAMS.feedInTariffEurKwh;
  const annualSavingsEur = Math.round(savedEnergyKwh * savingsPerKwh);

  // Mock: Estimate cost
  const pricePerKwh = 750; // EUR/kWh for battery system
  const estimatedCostEur = Math.round(recommendedSizeKwh * pricePerKwh);

  // Mock: Payback period
  const paybackYears =
    annualSavingsEur > 0
      ? Math.round((estimatedCostEur / annualSavingsEur) * 10) / 10
      : 99;

  // Mock: Viability assessment
  const isViable =
    paybackYears <= 12 && paybackYears < ECONOMIC_PARAMS.batteryLifetimeYears;

  // Generate recommendation text
  const recommendation = generateRecommendation(
    isViable,
    paybackYears,
    recommendedSizeKwh
  );

  return {
    recommendedSizeKwh,
    selfConsumptionWithout: Math.round(selfConsumptionWithout),
    selfConsumptionWith: Math.round(selfConsumptionWith),
    annualSavingsEur,
    estimatedCostEur,
    paybackYears,
    isViable,
    recommendation,
  };
}

/**
 * Generate a recommendation text based on results
 */
function generateRecommendation(
  isViable: boolean,
  paybackYears: number,
  recommendedSizeKwh: number
): string {
  if (paybackYears > 20) {
    return `Bei Ihrem Verbrauchsprofil ist ein Stromspeicher wirtschaftlich nicht sinnvoll. Die Amortisationszeit von über ${Math.round(
      paybackYears
    )} Jahren übersteigt die erwartete Lebensdauer deutlich.`;
  }

  if (paybackYears > 15) {
    return `Ein Speicher könnte sich langfristig lohnen, aber die Amortisation dauert mit ${paybackYears} Jahren sehr lange. Prüfen Sie, ob Sie Ihren Eigenverbrauch anderweitig erhöhen können.`;
  }

  if (paybackYears > 12) {
    return `Ein ${recommendedSizeKwh} kWh Speicher amortisiert sich in etwa ${paybackYears} Jahren. Das ist grenzwertig wirtschaftlich – wenn Sie Wert auf Unabhängigkeit legen, kann es dennoch sinnvoll sein.`;
  }

  if (isViable) {
    return `Ein ${recommendedSizeKwh} kWh Speicher ist für Sie wirtschaftlich sinnvoll. Mit einer Amortisation in ${paybackYears} Jahren haben Sie einen guten Return on Investment.`;
  }

  return `Basierend auf Ihren Angaben empfehlen wir einen ${recommendedSizeKwh} kWh Speicher. Bitte beachten Sie, dass dies eine Ersteinschätzung ist.`;
}

/**
 * Validate input before calculation
 */
export function validateInput(input: Partial<SpeicherInput>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.pvSizeKwp || input.pvSizeKwp <= 0) {
    errors.push("Bitte geben Sie eine gültige PV-Größe ein.");
  }

  if (!input.address || input.address.trim().length < 3) {
    errors.push("Bitte geben Sie eine gültige Adresse ein.");
  }

  if (input.azimuth === undefined || input.azimuth < 0 || input.azimuth > 360) {
    errors.push("Bitte geben Sie eine gültige Ausrichtung ein (0-360°).");
  }

  if (input.tilt === undefined || input.tilt < 0 || input.tilt > 90) {
    errors.push("Bitte geben Sie eine gültige Dachneigung ein (0-90°).");
  }

  if (!input.annualConsumptionKwh || input.annualConsumptionKwh <= 0) {
    errors.push("Bitte geben Sie Ihren Jahresverbrauch ein.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
