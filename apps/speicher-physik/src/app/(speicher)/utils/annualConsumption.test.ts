import { describe, expect, it } from "vitest";
import {
  ANNUAL_CONSUMPTION_INTEGER_MESSAGE,
  ANNUAL_CONSUMPTION_KWH_MAX,
  ANNUAL_CONSUMPTION_KWH_MIN,
  ANNUAL_CONSUMPTION_POSTAL_CODE_MESSAGE,
  ANNUAL_CONSUMPTION_RANGE_MESSAGE,
  assertValidAnnualConsumption,
  isPostalCodeAsAnnualConsumption,
  parseAnnualConsumptionInput,
  validateAnnualConsumption,
  withValidatedAnnualConsumption,
} from "./annualConsumption";

describe("parseAnnualConsumptionInput", () => {
  it("parses whole-kWh strings and numbers", () => {
    expect(parseAnnualConsumptionInput("4500")).toBe(4500);
    expect(parseAnnualConsumptionInput(4500)).toBe(4500);
    expect(parseAnnualConsumptionInput("500")).toBe(500);
    expect(parseAnnualConsumptionInput("")).toBeUndefined();
    expect(parseAnnualConsumptionInput("   ")).toBeUndefined();
    expect(parseAnnualConsumptionInput(undefined)).toBeUndefined();
  });

  it("does not silently truncate decimals", () => {
    expect(parseAnnualConsumptionInput("4500.5")).toBe(4500.5);
    expect(parseAnnualConsumptionInput(4500.5)).toBe(4500.5);
  });

  it("normalizes a single German decimal comma, then keeps the fractional value", () => {
    expect(parseAnnualConsumptionInput("4500,5")).toBe(4500.5);
    expect(parseAnnualConsumptionInput("4500,0")).toBe(4500);
  });

  it("rejects mixed or repeated separators instead of guessing", () => {
    expect(parseAnnualConsumptionInput("4.500,5")).toBeNaN();
    expect(parseAnnualConsumptionInput("4,500.5")).toBeNaN();
    expect(parseAnnualConsumptionInput("45,00,0")).toBeNaN();
    expect(parseAnnualConsumptionInput("4.500.0")).toBeNaN();
    expect(parseAnnualConsumptionInput("4500 kWh")).toBeNaN();
    expect(parseAnnualConsumptionInput("abc")).toBeNaN();
  });
});

describe("validateAnnualConsumption range and types", () => {
  it("accepts the inclusive bounds", () => {
    expect(
      validateAnnualConsumption({ annualConsumptionKwh: 500, postalCode: "80331" })
    ).toEqual({ ok: true, value: 500 });
    expect(
      validateAnnualConsumption({
        annualConsumptionKwh: 50000,
        postalCode: "80331",
      })
    ).toEqual({ ok: true, value: 50000 });
  });

  it("rejects 499, 50001, 86154, NaN, and Infinity", () => {
    for (const value of [499, 50001, 86154, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validateAnnualConsumption({
        annualConsumptionKwh: value,
        postalCode: "80331",
      });
      expect(result.ok, String(value)).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe(ANNUAL_CONSUMPTION_RANGE_MESSAGE);
      }
    }
  });

  it("rejects missing and malformed values", () => {
    expect(
      validateAnnualConsumption({ annualConsumptionKwh: undefined }).ok
    ).toBe(false);
    expect(validateAnnualConsumption({ annualConsumptionKwh: "" }).ok).toBe(
      false
    );
    expect(validateAnnualConsumption({ annualConsumptionKwh: "abc" }).ok).toBe(
      false
    );
    expect(validateAnnualConsumption({ annualConsumptionKwh: {} }).ok).toBe(
      false
    );
  });

  it("rejects non-integers with an explicit whole-kWh message", () => {
    const fromDot = validateAnnualConsumption({
      annualConsumptionKwh: "4500.5",
      postalCode: "80331",
    });
    expect(fromDot).toEqual({
      ok: false,
      code: "not_integer",
      message: ANNUAL_CONSUMPTION_INTEGER_MESSAGE,
    });

    const fromComma = validateAnnualConsumption({
      annualConsumptionKwh: "4500,5",
      postalCode: "80331",
    });
    expect(fromComma).toEqual({
      ok: false,
      code: "not_integer",
      message: ANNUAL_CONSUMPTION_INTEGER_MESSAGE,
    });
  });

  it("accepts a German comma that is exactly a whole kWh", () => {
    expect(
      validateAnnualConsumption({
        annualConsumptionKwh: "4500,0",
        postalCode: "80331",
      })
    ).toEqual({ ok: true, value: 4500 });
  });
});

describe("postal-code safeguard", () => {
  it("rejects when Hausverbrauch equals a valid 5-digit PLZ", () => {
    const result = validateAnnualConsumption({
      annualConsumptionKwh: 86154,
      postalCode: "86154",
    });
    expect(result).toEqual({
      ok: false,
      code: "matches_postal_code",
      message: ANNUAL_CONSUMPTION_POSTAL_CODE_MESSAGE,
    });
  });

  it("accepts a normal consumption with the same PLZ", () => {
    expect(
      validateAnnualConsumption({
        annualConsumptionKwh: 6000,
        postalCode: "86154",
      })
    ).toEqual({ ok: true, value: 6000 });
  });

  it("detects historical stored rows without deleting them", () => {
    expect(
      isPostalCodeAsAnnualConsumption({
        annualConsumptionKWh: 86154,
        postalCode: "86154",
      })
    ).toBe(true);
    expect(
      isPostalCodeAsAnnualConsumption({
        annualConsumptionKWh: 6000,
        postalCode: "86154",
      })
    ).toBe(false);
    expect(
      isPostalCodeAsAnnualConsumption({
        annualConsumptionKWh: 86154,
        postalCode: "80331",
      })
    ).toBe(false);
  });
});

describe("assertValidAnnualConsumption / withValidatedAnnualConsumption", () => {
  it("returns the integer and overwrites the input field", () => {
    const input = {
      annualConsumptionKWh: "6000" as unknown as number,
      postalCode: "86154",
      pvSystemKwP: 10,
    };
    const normalized = withValidatedAnnualConsumption(input);
    expect(normalized.annualConsumptionKWh).toBe(6000);
    expect(assertValidAnnualConsumption({
      annualConsumptionKwh: 500,
      postalCode: "80331",
    })).toBe(500);
  });

  it("throws before any calculation for invalid values", () => {
    expect(() =>
      assertValidAnnualConsumption({
        annualConsumptionKwh: 86154,
        postalCode: "86154",
      })
    ).toThrow(ANNUAL_CONSUMPTION_POSTAL_CODE_MESSAGE);

    expect(() =>
      withValidatedAnnualConsumption({
        annualConsumptionKWh: 86154,
        postalCode: "86154",
      })
    ).toThrow(ANNUAL_CONSUMPTION_POSTAL_CODE_MESSAGE);
  });

  it("exposes the advertised bounds", () => {
    expect(ANNUAL_CONSUMPTION_KWH_MIN).toBe(500);
    expect(ANNUAL_CONSUMPTION_KWH_MAX).toBe(50000);
  });
});
