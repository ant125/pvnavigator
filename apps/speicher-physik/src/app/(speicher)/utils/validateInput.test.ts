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

const VALID_FORM_BASE = {
  pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
  street: "Marienplatz",
  houseNumber: "1",
  postalCode: "80331",
  city: "München",
  annualConsumptionKwh: 4500,
} as const;

describe("validateInput heat pump (new UI)", () => {
  it("allows Nein without type, DHW, or consumption", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      heatPumpEnabled: false,
    });

    expect(result.isValid).toBe(true);
    expect(result.fieldErrors.heatPumpTechnology).toBeUndefined();
    expect(result.fieldErrors.heatPumpDhwService).toBeUndefined();
  });

  it("allows omitted heat-pump fields (legacy saved calculations)", () => {
    const result = validateInput({ ...VALID_FORM_BASE });

    expect(result.isValid).toBe(true);
  });

  it("requires type when a heat pump is enabled", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      heatPumpEnabled: true,
      heatPumpConsumptionKwh: 5000,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      SPEICHER_FIELD_INLINE_MESSAGES.heatPumpTechnology
    );
    expect(result.fieldErrors.heatPumpTechnology).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.heatPumpTechnology
    );
  });

  it("requires DHW once Luft/Wasser is selected", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      heatPumpEnabled: true,
      heatPumpConsumptionKwh: 5000,
      heatPumpTechnology: "luftwasser",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      SPEICHER_FIELD_INLINE_MESSAGES.heatPumpDhwService
    );
    expect(result.fieldErrors.heatPumpDhwService).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.heatPumpDhwService
    );
  });

  it("does not assume a DHW default", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      heatPumpEnabled: true,
      heatPumpConsumptionKwh: 5000,
      heatPumpTechnology: "luftwasser",
    });

    expect(result.fieldErrors.heatPumpDhwService).toBeDefined();
  });

  it("accepts Luft/Wasser with Heizung und Warmwasser", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      heatPumpEnabled: true,
      heatPumpConsumptionKwh: 5000,
      heatPumpTechnology: "luftwasser",
      heatPumpDhwService: "space_heat_and_dhw",
    });

    expect(result.isValid).toBe(true);
  });

  it("accepts Luft/Wasser with nur Heizung", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      heatPumpEnabled: true,
      heatPumpConsumptionKwh: 5000,
      heatPumpTechnology: "luftwasser",
      heatPumpDhwService: "space_heat_only",
    });

    expect(result.isValid).toBe(true);
  });

  it("accepts Wasser/Wasser with Heizung und Warmwasser", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      heatPumpEnabled: true,
      heatPumpConsumptionKwh: 5000,
      heatPumpTechnology: "wasserwasser",
      heatPumpDhwService: "space_heat_and_dhw",
    });

    expect(result.isValid).toBe(true);
  });

  it("rejects Wasser/Wasser with nur Heizung", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      heatPumpEnabled: true,
      heatPumpConsumptionKwh: 5000,
      heatPumpTechnology: "wasserwasser",
      heatPumpDhwService: "space_heat_only",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      SPEICHER_FIELD_INLINE_MESSAGES.heatPumpDhwService
    );
    expect(result.fieldErrors.heatPumpDhwService).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.heatPumpDhwService
    );
  });

  it("still requires annual heat-pump consumption when enabled", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      heatPumpEnabled: true,
      heatPumpTechnology: "luftwasser",
      heatPumpDhwService: "space_heat_and_dhw",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      SPEICHER_FIELD_INLINE_MESSAGES.heatPumpConsumptionKwh
    );
  });
});
