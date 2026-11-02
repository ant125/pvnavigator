import { describe, expect, it } from "vitest";

import { commuterEvInput } from "@/test/evFixtures";
import type { SpeicherInput } from "../types/speicher";
import { mapEvFormToCalculationInput } from "../utils/evForm";
import { buildHouseholdCalculationInput } from "./householdCalculationInput";
import {
  hydrateSavedCalculationInput,
  savedInputGapIsOpen,
} from "./savedCalculationForm";

const completeForm: Partial<SpeicherInput> = {
  street: "Musterstraße",
  houseNumber: "1",
  postalCode: "80331",
  city: "München",
  annualConsumptionKwh: 4500,
  pvSurfaces: [
    { systemSizeKwP: 8, tiltDeg: 35, azimuthDeg: 180 },
    { systemSizeKwP: 2.5, tiltDeg: 12, azimuthDeg: 95 },
  ],
  heatPumpEnabled: true,
  heatPumpTechnology: "wasserwasser",
  heatPumpDhwService: "space_heat_and_dhw",
  heatPumpConsumptionKwh: 5200,
  evEnabled: true,
  evAnnualKm: 15000,
  evConsumptionKwhPer100Km: 18,
  evUsableBatteryCapacityKwh: 60,
  evTypicalDailyKmWd: 40,
  evTypicalDailyKmSa: 20,
  evTypicalDailyKmSu: 10,
  evMaxHomeChargePowerKw: 11,
  evHomeWindowWd: { start: "18:00", end: "07:00" },
  evHomeWindowSa: { start: "10:00", end: "16:00" },
  evHomeWindowSu: { start: "10:00", end: "20:00" },
  evWorkplaceEnabled: true,
  evWorkplaceKwhPerMonth: 80,
  evWorkplaceChargingDaysPerMonth: 8,
  backupReserveKwh: 2,
};

describe("hydrateSavedCalculationInput", () => {
  it("restores a complete stored calculation without dropping roofs or components", () => {
    const stored = buildHouseholdCalculationInput(completeForm);
    const hydrated = hydrateSavedCalculationInput(stored);

    expect(hydrated.missing).toEqual([]);
    expect(hydrated.formData.street).toBe("Musterstraße");
    expect(hydrated.formData.houseNumber).toBe("1");
    expect(hydrated.formData.postalCode).toBe("80331");
    expect(hydrated.formData.city).toBe("München");
    expect(hydrated.formData.annualConsumptionKwh).toBe(4500);
    expect(hydrated.formData.pvSurfaces).toEqual(completeForm.pvSurfaces);
    expect(hydrated.kwpInputStrings).toEqual(["8", "2.5"]);
    expect(hydrated.azimuthInputStrings).toEqual(["180", "95"]);
    expect(hydrated.tiltInputStrings).toEqual(["35", "12"]);
    expect(hydrated.formData.heatPumpEnabled).toBe(true);
    expect(hydrated.formData.heatPumpTechnology).toBe("wasserwasser");
    expect(hydrated.formData.heatPumpDhwService).toBe("space_heat_and_dhw");
    expect(hydrated.formData.heatPumpConsumptionKwh).toBe(5200);
    expect(hydrated.formData.backupReserveKwh).toBe(2);
    expect(hydrated.totalKwPConfigured).toBe(10.5);
    expect(mapEvFormToCalculationInput(hydrated.formData)).toEqual(stored.ev);
  });

  it("keeps an explicit disabled heat pump, EV, and reserve", () => {
    const hydrated = hydrateSavedCalculationInput({
      street: "A",
      houseNumber: "1",
      postalCode: "80331",
      city: "München",
      annualConsumptionKWh: 4000,
      pvSystemKwP: 9.5,
      pvSurfaces: [{ systemSizeKwP: 9.5, tiltDeg: 30, azimuthDeg: 180 }],
      heatPumpEnabled: false,
      ev: { enabled: false },
      backupReserveKwh: 0,
    });

    expect(hydrated.missing.map((item) => item.id)).toEqual([]);
    expect(hydrated.formData.heatPumpEnabled).toBe(false);
    expect(hydrated.formData.evEnabled).toBe(false);
    expect(hydrated.formData.backupReserveKwh).toBe(0);
    expect(hydrated.kwpInputStrings).toEqual(["9.5"]);
  });

  it("does not invent tilt, azimuth, heat pump, EV, or reserve when they were not stored", () => {
    const hydrated = hydrateSavedCalculationInput({
      street: "Musterstraße",
      houseNumber: "1",
      postalCode: "80331",
      city: "München",
      annualConsumptionKWh: 4000,
      pvSystemKwP: 10,
      azimuthDeg: 180,
    });

    expect(hydrated.formData.heatPumpEnabled).toBeUndefined();
    expect(hydrated.formData.evEnabled).toBeUndefined();
    expect(hydrated.formData.backupReserveKwh).toBeUndefined();
    expect(hydrated.formData.pvSurfaces?.[0]).toEqual({
      systemSizeKwP: 10,
      tiltDeg: Number.NaN,
      azimuthDeg: 180,
    });
    expect(hydrated.tiltInputStrings).toEqual([""]);
    expect(hydrated.azimuthInputStrings).toEqual(["180"]);
    expect(hydrated.missing.map((item) => item.label)).toEqual([
      "Dachfläche 1: Neigung",
      "Wärmepumpe",
      "Elektroauto",
      "Notstromreserve",
    ]);
    expect(hydrated.totalKwPConfigured).toBe(10);
  });

  it("keeps a partial second roof instead of dropping it or filling default angles", () => {
    const hydrated = hydrateSavedCalculationInput({
      ...buildHouseholdCalculationInput({
        ...completeForm,
        evEnabled: false,
        heatPumpEnabled: false,
        backupReserveKwh: 0,
      }),
      ev: commuterEvInput(),
      pvSurfaces: [
        { systemSizeKwP: 8, tiltDeg: 35, azimuthDeg: 180 },
        { systemSizeKwP: 3 },
      ],
    });

    expect(hydrated.formData.pvSurfaces?.[1]).toEqual({
      systemSizeKwP: 3,
      tiltDeg: Number.NaN,
      azimuthDeg: Number.NaN,
    });
    expect(hydrated.missing.map((item) => item.id)).toEqual([
      "surface:1:azimuth",
      "surface:1:tilt",
    ]);
    expect(savedInputGapIsOpen(hydrated.formData, "surface:1:tilt")).toBe(true);
    const filled = {
      ...hydrated.formData,
      pvSurfaces: [
        hydrated.formData.pvSurfaces![0],
        { systemSizeKwP: 3, tiltDeg: 20, azimuthDeg: 90 },
      ],
    };
    expect(savedInputGapIsOpen(filled, "surface:1:tilt")).toBe(false);
  });
});
