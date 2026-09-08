import { describe, expect, it } from "vitest";

import type { HouseholdCalculationInput } from "@/app/(speicher)/calculate/runHouseholdCalculation";
import type { HouseholdCalculationPayload } from "@/app/(speicher)/calculate/runHouseholdCalculation";
import {
  mapCompletedCalculation,
  SPEICHER_GRENZE_INPUT_SCHEMA_VERSION,
  SPEICHER_GRENZE_PRODUCT_KEY,
  SPEICHER_GRENZE_RESULT_SCHEMA_VERSION,
} from "./persistCompletedCalculation";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const input: HouseholdCalculationInput = {
  annualConsumptionKWh: 4000,
  pvSystemKwP: 10,
  street: "Musterstraße",
  houseNumber: "1",
  postalCode: "80331",
  city: "München",
  tiltDeg: 35,
  azimuthDeg: 180,
  pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 35, azimuthDeg: 180 }],
  heatPumpEnabled: false,
  backupReserveKwh: 0,
};

const payload: HouseholdCalculationPayload = {
  displayAddress: "Musterstraße 1, 80331 München",
  verifiedResult: {
    energy: {
      year: {
        selfConsumptionWithoutStorage: 1800,
        pvYieldKwhAnnual: 9500,
      },
    },
    batteryModelVersion: "1.1.0",
  },
  speicherGrenz: {
    batterySizes: [5, 6, 7],
    average: { 5: 2100, 6: 2200, 7: 2280 },
    averageBatteryChargedKwh: { 5: 400, 6: 450, 7: 500 },
    averageBatteryDischargedKwh: { 5: 380, 6: 430, 7: 480 },
    averageDirectPvToHouseholdKwh: { 5: 1700, 6: 1700, 7: 1700 },
    averageDirectPvToAuxiliaryKwh: { 5: 0, 6: 0, 7: 0 },
    averageBatteryToHouseholdKwh: { 5: 380, 6: 430, 7: 480 },
    averageBatteryToAuxiliaryKwh: { 5: 0, 6: 0, 7: 0 },
    averageGridToHouseholdKwh: { 5: 1900, 6: 1850, 7: 1800 },
    averageGridToAuxiliaryKwh: { 5: 0, 6: 0, 7: 0 },
    averageGridExportKwh: { 5: 7400, 6: 7300, 7: 7200 },
    averageAuxiliaryConsumptionKwh: { 5: 0, 6: 0, 7: 0 },
    averageChargeLossKwh: { 5: 20, 6: 20, 7: 20 },
    averageDischargeLossKwh: { 5: 20, 6: 20, 7: 20 },
    averageChargeLossPvToBatteryKwh: { 5: 10, 6: 10, 7: 10 },
    averageChargeLossChemicalKwh: { 5: 10, 6: 10, 7: 10 },
    averageDischargeLossChemicalKwh: { 5: 10, 6: 10, 7: 10 },
    averageDischargeLossBatteryToAcKwh: { 5: 10, 6: 10, 7: 10 },
    averageSocStartKwh: { 5: 0, 6: 0, 7: 0 },
    averageSocEndKwh: { 5: 0, 6: 0, 7: 0 },
    averageSocEndPct: { 5: 0, 6: 0, 7: 0 },
    averageEnergyBalanceErrorKwh: { 5: 0, 6: 0, 7: 0 },
    averageSelfDischargeLossKwh: { 5: 0, 6: 0, 7: 0 },
    averageSelfConsumptionWithoutStorageKwh: 1800,
    averagePvYieldKwhAnnual: 9500,
    averageLoadKwhAnnual: 4000,
    batteryModelVersion: "1.1.0",
  },
  robustness: {
    cohortSize: 2,
    householdAnnualKwh: 4000,
    bdewTechnicalSizeKwh: 6,
    sizeUnchangedCount: 1,
    sizeFrequency: [{ sizeKwh: 6, householdCount: 2 }],
    ranges: {
      eigenverbrauchKwh: { min: 2000, p25: 2100, median: 2200, p75: 2300, max: 2400 },
      eigenverbrauchsquotePct: { min: 20, p25: 21, median: 22, p75: 23, max: 24 },
      autarkiePct: { min: 50, p25: 51, median: 52, p75: 53, max: 54 },
      netzbezugKwh: { min: 1600, p25: 1700, median: 1800, p75: 1900, max: 2000 },
      einspeisungKwh: { min: 7000, p25: 7100, median: 7200, p75: 7300, max: 7400 },
      technicalSpeichergrenzeKwh: { min: 5, p25: 5, median: 6, p75: 6, max: 7 },
    },
    conclusionParagraphs: ["Die empfohlene Größe bleibt robust."],
    houses: [
      {
        houseId: "h1",
        technicalSpeichergrenzeKwh: 6,
        eigenverbrauchKwh: 2200,
        eigenverbrauchsquotePct: 23,
        autarkiePct: 55,
        netzbezugKwh: 1800,
        einspeisungKwh: 7300,
      },
    ],
  },
  wasserWasserRobustness: null,
  heatPump: null,
  ev: null,
};

function longestArrayLength(value: unknown): number {
  if (Array.isArray(value)) {
    return Math.max(
      value.length,
      ...value.map((item) => longestArrayLength(item)),
    );
  }
  if (value && typeof value === "object") {
    return Math.max(
      0,
      ...Object.values(value).map((item) => longestArrayLength(item)),
    );
  }
  return 0;
}

function containsKey(value: unknown, key: string): boolean {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  return Object.values(value).some((item) => containsKey(item, key));
}

describe("mapCompletedCalculation", () => {
  const row = mapCompletedCalculation({
    userId: USER_ID,
    input,
    payload,
  });

  it("sets product_key, schema versions, and user_id", () => {
    expect(row.product_key).toBe(SPEICHER_GRENZE_PRODUCT_KEY);
    expect(row.product_key).toBe("speicher_grenze");
    expect(row.input_schema_version).toBe(SPEICHER_GRENZE_INPUT_SCHEMA_VERSION);
    expect(row.result_schema_version).toBe(SPEICHER_GRENZE_RESULT_SCHEMA_VERSION);
    expect(row.user_id).toBe(USER_ID);
    expect(row.battery_model_version).toBe("1.1.0");
  });

  it("populates listing summary fields", () => {
    expect(row.name).toBe("Musterstraße 1, 80331 München");
    expect(row.summary_address).toBe("Musterstraße 1, 80331 München");
    expect(row.summary_pv_kwp).toBe(10);
    expect(row.summary_consumption_kwh).toBe(4000);
  });

  it("does not persist large kernel or time-series arrays", () => {
    expect(longestArrayLength(row.result_snapshot)).toBeLessThan(50);
    expect(containsKey(row.result_snapshot, "hourly")).toBe(false);
    expect(containsKey(row.result_snapshot, "quarterHour")).toBe(false);
    expect(containsKey(row.result_snapshot, "profile")).toBe(false);
    expect(containsKey(row.input, "getPvForYear")).toBe(false);
  });
});
