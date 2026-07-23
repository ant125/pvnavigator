import { describe, expect, it } from "vitest";
import {
  SPEICHER_FIELD_INLINE_MESSAGES,
  validateAddressFields,
  validateInput,
} from "./validateInput";

describe("validateAddressFields", () => {
  it("accepts a complete valid address", () => {
    expect(
      validateAddressFields({
        postalCode: "80331",
        city: "München",
        street: "Marienplatz",
        houseNumber: "1",
      })
    ).toEqual({ errors: [], fieldErrors: {} });
  });

  it("requires all four fields", () => {
    expect(
      validateAddressFields({
        postalCode: "",
        city: "",
        street: "",
        houseNumber: "",
      })
    ).toEqual({
      errors: [
        "Bitte geben Sie die PLZ ein.",
        "Bitte geben Sie den Ort ein.",
        "Bitte geben Sie die Straße ein.",
        "Bitte geben Sie die Hausnummer ein.",
      ],
      fieldErrors: {
        postalCode: SPEICHER_FIELD_INLINE_MESSAGES.postalCode,
        city: SPEICHER_FIELD_INLINE_MESSAGES.city,
        street: SPEICHER_FIELD_INLINE_MESSAGES.street,
        houseNumber: SPEICHER_FIELD_INLINE_MESSAGES.houseNumber,
      },
    });
  });

  it("requires postalCode to be exactly five digits", () => {
    expect(
      validateAddressFields({
        postalCode: "8033",
        city: "München",
        street: "Marienplatz",
        houseNumber: "1",
      })
    ).toEqual({
      errors: ["Die PLZ muss aus genau fünf Ziffern bestehen."],
      fieldErrors: {
        postalCode: SPEICHER_FIELD_INLINE_MESSAGES.postalCode,
      },
    });
  });
});

describe("validateInput field errors", () => {
  it("includes address validation errors in validateInput", () => {
    const result = validateInput({
      pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
      street: "",
      houseNumber: "",
      postalCode: "123",
      city: "",
      annualConsumptionKwh: 4500,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Die PLZ muss aus genau fünf Ziffern bestehen."
    );
    expect(result.fieldErrors.postalCode).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.postalCode
    );
    expect(result.fieldErrors.city).toBe(SPEICHER_FIELD_INLINE_MESSAGES.city);
    expect(result.fieldErrors.street).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.street
    );
    expect(result.fieldErrors.houseNumber).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.houseNumber
    );
  });

  it("returns a field error for missing annualConsumptionKwh", () => {
    const result = validateInput({
      pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
      street: "Marienplatz",
      houseNumber: "1",
      postalCode: "80331",
      city: "München",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Bitte geben Sie Ihren Jahresverbrauch ein.");
    expect(result.fieldErrors.annualConsumptionKwh).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.annualConsumptionKwh
    );
  });

  it("can represent multiple invalid fields simultaneously", () => {
    const result = validateInput({
      pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
      street: "",
      houseNumber: "",
      postalCode: "12",
      city: "",
    });

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.postalCode).toBeDefined();
    expect(result.fieldErrors.city).toBeDefined();
    expect(result.fieldErrors.street).toBeDefined();
    expect(result.fieldErrors.houseNumber).toBeDefined();
    expect(result.fieldErrors.annualConsumptionKwh).toBeDefined();
  });
});
