/**
 * Customer-facing German mapping for package EV errors.
 * Does not reimplement feasibility; only translates typed codes.
 */

import { EvProfileError } from "@ev-profile/loader";
import { EV_FIELD_MESSAGES, EV_INFEASIBLE_MESSAGE } from "./evForm";

const INVALID_INPUT_MESSAGES: Partial<Record<string, string>> = {
  INVALID_ANNUAL_KM: EV_FIELD_MESSAGES.evAnnualKm,
  INVALID_CONSUMPTION: EV_FIELD_MESSAGES.evConsumptionKwhPer100Km,
  INVALID_CAPACITY: EV_FIELD_MESSAGES.evUsableBatteryCapacityKwh,
  INVALID_TYPICAL_KM:
    "Bitte geben Sie die typischen Fahrstrecken für Werktag, Samstag und Sonntag an.",
  INVALID_CHARGE_POWER: EV_FIELD_MESSAGES.evMaxHomeChargePowerKw,
  MISSING_TEMPORAL_SHAPE:
    "Bitte geben Sie typische Fahrstrecken an, die zu Ihrer jährlichen Fahrleistung passen.",
  INVALID_WINDOW: "Bitte geben Sie ein gültiges Ladefenster an.",
  WORKPLACE_MISSING_FIELDS: EV_FIELD_MESSAGES.evWorkplaceEnabled,
  WORKPLACE_INVALID_ENERGY: EV_FIELD_MESSAGES.evWorkplaceKwhPerMonth,
  WORKPLACE_INVALID_DAYS: EV_FIELD_MESSAGES.evWorkplaceChargingDaysPerMonth,
  WORKPLACE_DAYS_EXCEED_WEEKDAYS:
    "Die angegebene Anzahl der Ladetage übersteigt die Arbeitstage in mindestens einem Monat. Bitte prüfen Sie Ihre Angabe.",
};

function messageForEvProfileError(error: EvProfileError): string {
  if (error.kind === "infeasible") {
    return EV_INFEASIBLE_MESSAGE;
  }
  return INVALID_INPUT_MESSAGES[error.code] ?? EV_INFEASIBLE_MESSAGE;
}

export function toGermanEvError(error: unknown): Error {
  if (error instanceof EvProfileError) {
    return new Error(messageForEvProfileError(error));
  }
  if (
    error instanceof Error &&
    (error.message.startsWith("ev: enabled configuration is missing") ||
      error.message.startsWith("ev: enabled form") ||
      error.message.startsWith("ev: workplace fields"))
  ) {
    return new Error(
      "Bitte prüfen Sie Ihre Angaben zum Elektroauto. Es fehlen erforderliche Felder."
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(
    "Die Berechnung ist fehlgeschlagen. Bitte versuchen Sie es erneut."
  );
}
