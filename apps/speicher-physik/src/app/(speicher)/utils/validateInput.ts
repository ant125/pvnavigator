/**
 * Form input validation for Speicher calculator.
 * UI/orchestration only – no calculation logic.
 */

import type { PvSurfaceInput, SpeicherInput } from "../types/speicher";
import {
  EV_FIELD_MESSAGES,
  isEvHomeChargePowerKw,
  isPresentFiniteNumber,
  isPresentNonNegativeNumber,
  validateHomeWindowForm,
} from "./evForm";

/** Match single-field PV-Anlagengröße (kWp): min 1, max 100 (total when multi-roof). */
const PV_TOTAL_KWP_MAX = 100;
const PV_PER_SURFACE_KWP_MAX = 100;

const POSTAL_CODE_PATTERN = /^\d{5}$/;

export const SPEICHER_FIELD_INLINE_MESSAGES = {
  postalCode: "Bitte geben Sie eine gültige fünfstellige PLZ ein.",
  city: "Bitte geben Sie einen Ort ein.",
  street: "Bitte geben Sie eine Straße ein.",
  houseNumber: "Bitte geben Sie eine Hausnummer ein.",
  annualConsumptionKwh: "Bitte geben Sie einen gültigen Hausverbrauch ein.",
  heatPumpTechnology: "Bitte wählen Sie den Typ der Wärmepumpe.",
  heatPumpDhwService:
    "Bitte wählen Sie, wofür die Wärmepumpe verwendet wird.",
  heatPumpConsumptionKwh:
    "Bitte geben Sie den jährlichen Stromverbrauch der Wärmepumpe ein.",
  ...EV_FIELD_MESSAGES,
} as const;

export type SpeicherFieldErrorKey = keyof typeof SPEICHER_FIELD_INLINE_MESSAGES;

export type SpeicherFieldErrors = Partial<
  Record<SpeicherFieldErrorKey, string>
>;

function pushFieldError(
  errors: string[],
  fieldErrors: SpeicherFieldErrors,
  key: SpeicherFieldErrorKey
): void {
  const message = SPEICHER_FIELD_INLINE_MESSAGES[key];
  errors.push(message);
  fieldErrors[key] = message;
}

function validateRequiredNonNegative(
  value: number | undefined,
  key: SpeicherFieldErrorKey,
  errors: string[],
  fieldErrors: SpeicherFieldErrors
): void {
  if (!isPresentNonNegativeNumber(value)) {
    pushFieldError(errors, fieldErrors, key);
  }
}

function validateEvHomeWindow(
  window: SpeicherInput["evHomeWindowWd"],
  key: "evHomeWindowWd" | "evHomeWindowSa" | "evHomeWindowSu",
  errors: string[],
  fieldErrors: SpeicherFieldErrors
): void {
  if (validateHomeWindowForm(window) !== "ok") {
    pushFieldError(errors, fieldErrors, key);
  }
}

function validateEvFormFields(
  input: Partial<SpeicherInput>,
  errors: string[],
  fieldErrors: SpeicherFieldErrors
): void {
  validateRequiredNonNegative(
    input.evAnnualKm,
    "evAnnualKm",
    errors,
    fieldErrors
  );
  validateRequiredNonNegative(
    input.evConsumptionKwhPer100Km,
    "evConsumptionKwhPer100Km",
    errors,
    fieldErrors
  );

  const evCapacity = input.evUsableBatteryCapacityKwh;
  if (!isPresentFiniteNumber(evCapacity) || evCapacity <= 0) {
    pushFieldError(errors, fieldErrors, "evUsableBatteryCapacityKwh");
  }

  validateRequiredNonNegative(
    input.evTypicalDailyKmWd,
    "evTypicalDailyKmWd",
    errors,
    fieldErrors
  );
  validateRequiredNonNegative(
    input.evTypicalDailyKmSa,
    "evTypicalDailyKmSa",
    errors,
    fieldErrors
  );
  validateRequiredNonNegative(
    input.evTypicalDailyKmSu,
    "evTypicalDailyKmSu",
    errors,
    fieldErrors
  );

  if (!isEvHomeChargePowerKw(input.evMaxHomeChargePowerKw)) {
    pushFieldError(errors, fieldErrors, "evMaxHomeChargePowerKw");
  }

  validateEvHomeWindow(
    input.evHomeWindowWd,
    "evHomeWindowWd",
    errors,
    fieldErrors
  );
  validateEvHomeWindow(
    input.evHomeWindowSa,
    "evHomeWindowSa",
    errors,
    fieldErrors
  );
  validateEvHomeWindow(
    input.evHomeWindowSu,
    "evHomeWindowSu",
    errors,
    fieldErrors
  );

  if (input.evWorkplaceEnabled !== true && input.evWorkplaceEnabled !== false) {
    pushFieldError(errors, fieldErrors, "evWorkplaceEnabled");
  } else if (input.evWorkplaceEnabled === true) {
    validateRequiredNonNegative(
      input.evWorkplaceKwhPerMonth,
      "evWorkplaceKwhPerMonth",
      errors,
      fieldErrors
    );
    if (
      !Number.isInteger(input.evWorkplaceChargingDaysPerMonth) ||
      !isPresentNonNegativeNumber(input.evWorkplaceChargingDaysPerMonth)
    ) {
      pushFieldError(errors, fieldErrors, "evWorkplaceChargingDaysPerMonth");
    }
  }
}

function validatePvSurfacesList(
  surfaces: PvSurfaceInput[],
  errors: string[]
): void {
  if (surfaces.length === 0) {
    errors.push("Mindestens eine Dachfläche ist erforderlich.");
    return;
  }
  let totalKwP = 0;
  surfaces.forEach((s, idx) => {
    const plane = idx + 1;
    const kwp = s.systemSizeKwP;
    if (!Number.isFinite(kwp) || kwp <= 0) {
      errors.push(`Dachfläche ${plane}: Bitte eine gültige PV-Leistung (kWp) eingeben.`);
    } else {
      if (kwp > PV_PER_SURFACE_KWP_MAX) {
        errors.push(`Dachfläche ${plane}: PV-Leistung darf maximal ${PV_PER_SURFACE_KWP_MAX} kWp sein.`);
      }
      totalKwP += kwp;
    }

    const tilt = s.tiltDeg;
    if (!Number.isFinite(tilt) || tilt < 0 || tilt > 90) {
      errors.push(`Dachfläche ${plane}: Neigung muss zwischen 0° und 90° liegen.`);
    }

    const az = s.azimuthDeg;
    if (
      !Number.isFinite(az) ||
      !Number.isInteger(az) ||
      az < 0 ||
      az > 359
    ) {
      errors.push(`Dachfläche ${plane}: Ausrichtung als ganze Zahl 0–359° (von Nord aus im Uhrzeigersinn).`);
    }
  });
  if (totalKwP > PV_TOTAL_KWP_MAX) {
    errors.push(`Gesamt-PV darf höchstens ${PV_TOTAL_KWP_MAX} kWp sein (über alle Dachflächen).`);
  }
}

export function validateAddressFields(input: {
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
}): { errors: string[]; fieldErrors: SpeicherFieldErrors } {
  const errors: string[] = [];
  const fieldErrors: SpeicherFieldErrors = {};

  if (!input.postalCode?.trim()) {
    errors.push("Bitte geben Sie die PLZ ein.");
    fieldErrors.postalCode = SPEICHER_FIELD_INLINE_MESSAGES.postalCode;
  } else if (!POSTAL_CODE_PATTERN.test(input.postalCode.trim())) {
    errors.push("Die PLZ muss aus genau fünf Ziffern bestehen.");
    fieldErrors.postalCode = SPEICHER_FIELD_INLINE_MESSAGES.postalCode;
  }

  if (!input.city?.trim()) {
    errors.push("Bitte geben Sie den Ort ein.");
    fieldErrors.city = SPEICHER_FIELD_INLINE_MESSAGES.city;
  }

  if (!input.street?.trim()) {
    errors.push("Bitte geben Sie die Straße ein.");
    fieldErrors.street = SPEICHER_FIELD_INLINE_MESSAGES.street;
  }

  if (!input.houseNumber?.trim()) {
    errors.push("Bitte geben Sie die Hausnummer ein.");
    fieldErrors.houseNumber = SPEICHER_FIELD_INLINE_MESSAGES.houseNumber;
  }

  return { errors, fieldErrors };
}

export function validateInput(input: Partial<SpeicherInput>): {
  isValid: boolean;
  errors: string[];
  fieldErrors: SpeicherFieldErrors;
} {
  const errors: string[] = [];
  const fieldErrors: SpeicherFieldErrors = {};

  const surfaces = input.pvSurfaces;
  if (surfaces && surfaces.length > 0) {
    validatePvSurfacesList(surfaces, errors);
  } else {
    if (!input.pvSizeKwp || input.pvSizeKwp <= 0) {
      errors.push("Bitte geben Sie eine gültige PV-Größe ein.");
    }
    if (
      typeof input.pvSizeKwp === "number" &&
      input.pvSizeKwp > PV_TOTAL_KWP_MAX
    ) {
      errors.push(`PV-Anlage darf höchstens ${PV_TOTAL_KWP_MAX} kWp sein.`);
    }

    const az = input.azimuth;
    if (
      az === undefined ||
      !Number.isFinite(az) ||
      !Number.isInteger(az) ||
      az < 0 ||
      az > 359
    ) {
      errors.push("Bitte geben Sie eine gültige Ausrichtung ein (0–359°).");
    }

    if (input.tilt === undefined || input.tilt < 0 || input.tilt > 90) {
      errors.push("Bitte geben Sie eine gültige Dachneigung ein (0-90°).");
    }
  }

  const addressValidation = validateAddressFields({
    street: input.street,
    houseNumber: input.houseNumber,
    postalCode: input.postalCode,
    city: input.city,
  });
  errors.push(...addressValidation.errors);
  Object.assign(fieldErrors, addressValidation.fieldErrors);

  if (!input.annualConsumptionKwh || input.annualConsumptionKwh <= 0) {
    errors.push("Bitte geben Sie Ihren Jahresverbrauch ein.");
    fieldErrors.annualConsumptionKwh =
      SPEICHER_FIELD_INLINE_MESSAGES.annualConsumptionKwh;
  }

  // New UI: type and DHW must be chosen before calculate. Legacy API
  // requests that omit these fields still resolve in the production adapter.
  if (input.heatPumpEnabled) {
    const hp = input.heatPumpConsumptionKwh;
    if (
      hp === undefined ||
      !Number.isFinite(hp) ||
      hp <= 0
    ) {
      errors.push(SPEICHER_FIELD_INLINE_MESSAGES.heatPumpConsumptionKwh);
      fieldErrors.heatPumpConsumptionKwh =
        SPEICHER_FIELD_INLINE_MESSAGES.heatPumpConsumptionKwh;
    }

    if (
      input.heatPumpTechnology !== "luftwasser" &&
      input.heatPumpTechnology !== "wasserwasser"
    ) {
      errors.push(SPEICHER_FIELD_INLINE_MESSAGES.heatPumpTechnology);
      fieldErrors.heatPumpTechnology =
        SPEICHER_FIELD_INLINE_MESSAGES.heatPumpTechnology;
    } else if (input.heatPumpTechnology === "wasserwasser") {
      if (input.heatPumpDhwService !== "space_heat_and_dhw") {
        errors.push(SPEICHER_FIELD_INLINE_MESSAGES.heatPumpDhwService);
        fieldErrors.heatPumpDhwService =
          SPEICHER_FIELD_INLINE_MESSAGES.heatPumpDhwService;
      }
    } else if (
      input.heatPumpDhwService !== "space_heat_only" &&
      input.heatPumpDhwService !== "space_heat_and_dhw"
    ) {
      errors.push(SPEICHER_FIELD_INLINE_MESSAGES.heatPumpDhwService);
      fieldErrors.heatPumpDhwService =
        SPEICHER_FIELD_INLINE_MESSAGES.heatPumpDhwService;
    }
  }

  if (input.evEnabled === true) {
    validateEvFormFields(input, errors, fieldErrors);
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
    fieldErrors,
  };
}
