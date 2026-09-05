import { invalidInput } from "./errors";
import type { CreateEvProfileInput, EvClockTime, EvHomeWindow } from "./types";

function requireFiniteNonNegative(
  value: number,
  code: Parameters<typeof invalidInput>[0],
  name: string
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw invalidInput(code, `${name} must be a finite number ≥ 0`, {
      [name]: value,
    });
  }
}

function assertClockShape(time: EvClockTime, role: string): void {
  if (
    time == null ||
    typeof time !== "object" ||
    !Number.isFinite(time.hour) ||
    !Number.isFinite(time.minute)
  ) {
    throw invalidInput("INVALID_WINDOW", `${role} clock time is missing`, {
      time,
    });
  }
}

function assertWindow(window: EvHomeWindow, dayType: string): void {
  if (window == null || typeof window !== "object" || !("kind" in window)) {
    throw invalidInput(
      "INVALID_WINDOW",
      `${dayType} home window must be an explicit encoding`,
      { window }
    );
  }
  if (window.kind === "unavailable" || window.kind === "fullDay") return;
  if (window.kind === "bounded") {
    assertClockShape(window.start, `${dayType}.start`);
    assertClockShape(window.end, `${dayType}.end`);
    return;
  }
  throw invalidInput(
    "INVALID_WINDOW",
    `${dayType} home window kind must be unavailable, fullDay, or bounded`,
    { window }
  );
}

export function validateEvProfileInput(input: CreateEvProfileInput): void {
  if (input == null || typeof input !== "object") {
    throw invalidInput("INVALID_YEAR", "EV input is required");
  }

  requireFiniteNonNegative(input.annualKm, "INVALID_ANNUAL_KM", "annualKm");
  requireFiniteNonNegative(
    input.typicalDailyKm?.WD,
    "INVALID_TYPICAL_KM",
    "typicalDailyKm.WD"
  );
  requireFiniteNonNegative(
    input.typicalDailyKm?.SA,
    "INVALID_TYPICAL_KM",
    "typicalDailyKm.SA"
  );
  requireFiniteNonNegative(
    input.typicalDailyKm?.SU,
    "INVALID_TYPICAL_KM",
    "typicalDailyKm.SU"
  );
  requireFiniteNonNegative(
    input.consumptionKwhPer100Km,
    "INVALID_CONSUMPTION",
    "consumptionKwhPer100Km"
  );
  if (
    !Number.isFinite(input.usableBatteryCapacityKwh) ||
    !(input.usableBatteryCapacityKwh > 0)
  ) {
    throw invalidInput(
      "INVALID_CAPACITY",
      "usableBatteryCapacityKwh must be a finite number > 0",
      { usableBatteryCapacityKwh: input.usableBatteryCapacityKwh }
    );
  }
  requireFiniteNonNegative(
    input.maxHomeChargePowerKw,
    "INVALID_CHARGE_POWER",
    "maxHomeChargePowerKw"
  );

  if (
    input.annualKm > 0 &&
    input.typicalDailyKm.WD === 0 &&
    input.typicalDailyKm.SA === 0 &&
    input.typicalDailyKm.SU === 0
  ) {
    throw invalidInput(
      "MISSING_TEMPORAL_SHAPE",
      "annual km > 0 while all WD/SA/SU typical distances are zero",
      { annualKm: input.annualKm, typicalDailyKm: input.typicalDailyKm }
    );
  }

  assertWindow(input.homeWindow?.WD, "WD");
  assertWindow(input.homeWindow?.SA, "SA");
  assertWindow(input.homeWindow?.SU, "SU");

  const workplace = input.workplace;
  if (workplace == null || typeof workplace !== "object") {
    throw invalidInput(
      "WORKPLACE_MISSING_FIELDS",
      "workplace must be explicitly enabled or disabled"
    );
  }
  if (workplace.enabled === false) return;
  if (workplace.enabled !== true) {
    throw invalidInput(
      "WORKPLACE_MISSING_FIELDS",
      "workplace.enabled must be true or false"
    );
  }
  if (
    !Number.isFinite(workplace.kwhPerMonth) ||
    workplace.kwhPerMonth < 0
  ) {
    throw invalidInput(
      "WORKPLACE_INVALID_ENERGY",
      "workplace kwhPerMonth must be a finite number ≥ 0",
      { kwhPerMonth: workplace.kwhPerMonth }
    );
  }
  if (
    !Number.isInteger(workplace.chargingDaysPerMonth) ||
    workplace.chargingDaysPerMonth < 0
  ) {
    throw invalidInput(
      "WORKPLACE_INVALID_DAYS",
      "chargingDaysPerMonth must be an integer ≥ 0",
      { chargingDaysPerMonth: workplace.chargingDaysPerMonth }
    );
  }
  if (workplace.kwhPerMonth > 0 && workplace.chargingDaysPerMonth <= 0) {
    throw invalidInput(
      "WORKPLACE_INVALID_DAYS",
      "workplace kWh/month > 0 requires chargingDaysPerMonth > 0",
      {
        kwhPerMonth: workplace.kwhPerMonth,
        chargingDaysPerMonth: workplace.chargingDaysPerMonth,
      }
    );
  }
}
