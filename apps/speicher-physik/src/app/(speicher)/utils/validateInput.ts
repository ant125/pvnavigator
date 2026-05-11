/**
 * Form input validation for Speicher calculator.
 * UI/orchestration only – no calculation logic.
 */

import type { SpeicherInput } from "../types/speicher";

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

  if (input.heatPumpEnabled) {
    const hp = input.heatPumpConsumptionKwh;
    if (
      hp === undefined ||
      !Number.isFinite(hp) ||
      hp <= 0
    ) {
      errors.push(
        "Bitte geben Sie den jährlichen Stromverbrauch der Wärmepumpe ein."
      );
    }
  }

  const reserve = input.backupReserveKwh ?? 0;
  if (!Number.isFinite(reserve)) {
    errors.push("Bitte geben Sie eine gültige Notstromreserve ein.");
  } else if (reserve < 0 || reserve > 5) {
    errors.push("Notstromreserve muss zwischen 0 und 5 kWh liegen.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
