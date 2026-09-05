import { describe, expect, it } from "vitest";
import { EvProfileError } from "@ev-profile/loader";
import { EV_FIELD_MESSAGES, EV_INFEASIBLE_MESSAGE } from "./evForm";
import { toGermanEvError } from "./toGermanEvError";

describe("toGermanEvError", () => {
  it("maps infeasible driving to the customer message", () => {
    const error = new EvProfileError(
      "DRIVING_UNSERVED",
      "infeasible",
      "internal solver wording"
    );
    expect(toGermanEvError(error).message).toBe(EV_INFEASIBLE_MESSAGE);
    expect(toGermanEvError(error).message).not.toMatch(/solver/i);
  });

  it("maps typed invalid-input codes to specific German copy", () => {
    const error = new EvProfileError(
      "INVALID_WINDOW",
      "invalid_input",
      "start === end is not 24-hour availability"
    );
    expect(toGermanEvError(error).message).toBe(
      "Bitte geben Sie ein gültiges Ladefenster an."
    );
  });

  it("maps workplace day overflow specifically", () => {
    const error = new EvProfileError(
      "WORKPLACE_DAYS_EXCEED_WEEKDAYS",
      "invalid_input",
      "chargingDaysPerMonth exceeds weekdays"
    );
    expect(toGermanEvError(error).message).toMatch(/Ladetage/);
  });

  it("maps missing enabled fields without exposing internals", () => {
    const error = new Error(
      "ev: enabled configuration is missing required fields: annualKm"
    );
    expect(toGermanEvError(error).message).toMatch(/Elektroauto/);
    expect(toGermanEvError(error).message).not.toMatch(/annualKm/);
  });

  it("keeps unrelated errors unchanged", () => {
    const error = new Error("Die Adresse konnte nicht gefunden werden.");
    expect(toGermanEvError(error)).toBe(error);
  });

  it("uses the annual-km form message for INVALID_ANNUAL_KM", () => {
    const error = new EvProfileError(
      "INVALID_ANNUAL_KM",
      "invalid_input",
      "annualKm must be a finite number ≥ 0"
    );
    expect(toGermanEvError(error).message).toBe(EV_FIELD_MESSAGES.evAnnualKm);
  });
});
