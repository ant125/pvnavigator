import { describe, expect, it } from "vitest";
import type { SpeicherInput } from "../types/speicher";
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

const VALID_FORM_BASE: Partial<SpeicherInput> = {
  pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
  street: "Marienplatz",
  houseNumber: "1",
  postalCode: "80331",
  city: "München",
  annualConsumptionKwh: 4500,
};

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

const VALID_EV_FORM = {
  evEnabled: true,
  evAnnualKm: 15000,
  evConsumptionKwhPer100Km: 18,
  evUsableBatteryCapacityKwh: 77,
  evTypicalDailyKmWd: 40,
  evTypicalDailyKmSa: 25,
  evTypicalDailyKmSu: 10,
  evMaxHomeChargePowerKw: 11,
  evHomeWindowWd: { fullDay: false, start: "17:30", end: "07:00" },
  evHomeWindowSa: { fullDay: true, start: "", end: "" },
  evHomeWindowSu: { fullDay: false, start: "10:00", end: "20:00" },
  evWorkplaceEnabled: false,
} as const;

describe("validateInput EV (new UI)", () => {
  it("allows Nein / omitted EV without requiring EV fields", () => {
    expect(validateInput({ ...VALID_FORM_BASE }).isValid).toBe(true);
    expect(
      validateInput({ ...VALID_FORM_BASE, evEnabled: false }).isValid
    ).toBe(true);
    const result = validateInput({ ...VALID_FORM_BASE, evEnabled: false });
    expect(result.fieldErrors.evAnnualKm).toBeUndefined();
    expect(result.fieldErrors.evMaxHomeChargePowerKw).toBeUndefined();
  });

  it("accepts a complete EV form with workplace Nein", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      ...VALID_EV_FORM,
    });
    expect(result.isValid).toBe(true);
    expect(result.fieldErrors.evWorkplaceKwhPerMonth).toBeUndefined();
    expect(result.fieldErrors.evWorkplaceChargingDaysPerMonth).toBeUndefined();
  });

  it("fails each required core field when EV is Ja", () => {
    const requiredKeys = [
      "evAnnualKm",
      "evConsumptionKwhPer100Km",
      "evUsableBatteryCapacityKwh",
      "evTypicalDailyKmWd",
      "evTypicalDailyKmSa",
      "evTypicalDailyKmSu",
      "evMaxHomeChargePowerKw",
      "evHomeWindowWd",
      "evHomeWindowSa",
      "evHomeWindowSu",
      "evWorkplaceEnabled",
    ] as const;

    for (const key of requiredKeys) {
      const form = { ...VALID_FORM_BASE, ...VALID_EV_FORM, [key]: undefined };
      const result = validateInput(form);
      expect(result.isValid, key).toBe(false);
      expect(result.fieldErrors[key], key).toBe(
        SPEICHER_FIELD_INLINE_MESSAGES[key]
      );
    }
  });

  it("requires both workplace fields when workplace is Ja", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      ...VALID_EV_FORM,
      evWorkplaceEnabled: true,
    });
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.evWorkplaceKwhPerMonth).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.evWorkplaceKwhPerMonth
    );
    expect(result.fieldErrors.evWorkplaceChargingDaysPerMonth).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.evWorkplaceChargingDaysPerMonth
    );
  });

  it("accepts workplace Ja when both workplace fields are present", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      ...VALID_EV_FORM,
      evWorkplaceEnabled: true,
      evWorkplaceKwhPerMonth: 100,
      evWorkplaceChargingDaysPerMonth: 4,
    });
    expect(result.isValid).toBe(true);
  });

  it("rejects a non-integer workplace charging-day count", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      ...VALID_EV_FORM,
      evWorkplaceEnabled: true,
      evWorkplaceKwhPerMonth: 100,
      evWorkplaceChargingDaysPerMonth: 4.5,
    });
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.evWorkplaceChargingDaysPerMonth).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.evWorkplaceChargingDaysPerMonth
    );
  });

  it("rejects a charging power that is not one of the allowed values", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      ...VALID_EV_FORM,
      evMaxHomeChargePowerKw: 10 as never,
    });
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.evMaxHomeChargePowerKw).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.evMaxHomeChargePowerKw
    );
  });

  it("rejects equal start/end as a full-day window", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      ...VALID_EV_FORM,
      evHomeWindowSa: { fullDay: false, start: "12:00", end: "12:00" },
    });
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.evHomeWindowSa).toBe(
      SPEICHER_FIELD_INLINE_MESSAGES.evHomeWindowSa
    );
  });

  it("still accepts Wärmepumpe together with a valid EV form", () => {
    const result = validateInput({
      ...VALID_FORM_BASE,
      ...VALID_EV_FORM,
      heatPumpEnabled: true,
      heatPumpConsumptionKwh: 5000,
      heatPumpTechnology: "luftwasser",
      heatPumpDhwService: "space_heat_and_dhw",
    });
    expect(result.isValid).toBe(true);
  });
});
