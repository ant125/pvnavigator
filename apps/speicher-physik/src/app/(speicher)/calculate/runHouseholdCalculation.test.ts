import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANNUAL_CONSUMPTION_POSTAL_CODE_MESSAGE,
  ANNUAL_CONSUMPTION_RANGE_MESSAGE,
} from "../utils/annualConsumption";

const geocodeAddress = vi.fn();
const buildAddressString = vi.fn(() => "Branderstraße 44, 86154 Augsburg");
const calculateSpeicherResult = vi.fn();

vi.mock("@geocoding/core", () => ({
  buildAddressString: () => buildAddressString(),
  geocodeAddress: () => geocodeAddress(),
}));

vi.mock("@/lib/calculateSpeicherResult", () => ({
  calculateSpeicherResult: () => calculateSpeicherResult(),
}));

import { runHouseholdCalculation } from "./runHouseholdCalculation";

const BASE_PARAMS = {
  annualConsumptionKWh: 6000,
  pvSystemKwP: 10,
  street: "Branderstraße",
  houseNumber: "44",
  postalCode: "86154",
  city: "Augsburg",
  tiltDeg: 30,
  azimuthDeg: 180,
  pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
  heatPumpEnabled: false,
  backupReserveKwh: 0,
};

describe("runHouseholdCalculation Hausverbrauch gate", () => {
  beforeEach(() => {
    geocodeAddress.mockReset();
    calculateSpeicherResult.mockReset();
    buildAddressString.mockClear();
  });

  it("rejects PLZ-as-consumption before geocode and kernel", async () => {
    await expect(
      runHouseholdCalculation({
        ...BASE_PARAMS,
        annualConsumptionKWh: 86154,
      })
    ).rejects.toThrow(ANNUAL_CONSUMPTION_POSTAL_CODE_MESSAGE);

    expect(geocodeAddress).not.toHaveBeenCalled();
    expect(calculateSpeicherResult).not.toHaveBeenCalled();
  });

  it("rejects out-of-range values before geocode and kernel", async () => {
    await expect(
      runHouseholdCalculation({
        ...BASE_PARAMS,
        annualConsumptionKWh: 499,
      })
    ).rejects.toThrow(ANNUAL_CONSUMPTION_RANGE_MESSAGE);

    await expect(
      runHouseholdCalculation({
        ...BASE_PARAMS,
        annualConsumptionKWh: 50001,
      })
    ).rejects.toThrow(ANNUAL_CONSUMPTION_RANGE_MESSAGE);

    expect(geocodeAddress).not.toHaveBeenCalled();
    expect(calculateSpeicherResult).not.toHaveBeenCalled();
  });

  it("rejects non-finite values before geocode and kernel", async () => {
    await expect(
      runHouseholdCalculation({
        ...BASE_PARAMS,
        annualConsumptionKWh: Number.NaN,
      })
    ).rejects.toThrow(ANNUAL_CONSUMPTION_RANGE_MESSAGE);

    expect(geocodeAddress).not.toHaveBeenCalled();
    expect(calculateSpeicherResult).not.toHaveBeenCalled();
  });
});
