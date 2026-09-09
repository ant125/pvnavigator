import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { HouseholdCalculationInput } from "@/app/(speicher)/calculate/runHouseholdCalculation";
import type { HouseholdCalculationPayload } from "@/app/(speicher)/calculate/runHouseholdCalculation";
import {
  mapCompletedCalculation,
  SPEICHER_GRENZE_RESULT_SCHEMA_VERSION_V1,
} from "@/lib/persistCompletedCalculation";
import {
  resolveHistoricalSpeicherReport,
  type CalculationHistoryRow,
} from "@/lib/historicalSpeicherReport";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CALC_ID = "22222222-2222-4222-8222-222222222222";

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

function rowFromInsert(
  overrides: Partial<CalculationHistoryRow> = {},
): CalculationHistoryRow {
  const mapped = mapCompletedCalculation({ userId: USER_ID, input, payload });
  return {
    id: CALC_ID,
    product_key: mapped.product_key,
    input: mapped.input,
    result_snapshot: mapped.result_snapshot,
    input_schema_version: mapped.input_schema_version,
    result_schema_version: mapped.result_schema_version,
    battery_model_version: mapped.battery_model_version,
    created_at: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("resolveHistoricalSpeicherReport", () => {
  it("parses a v1 snapshot without a frozen presentation override", () => {
    const snapshot = mapCompletedCalculation({
      userId: USER_ID,
      input,
      payload,
    }).result_snapshot;
    const { presentation: _presentation, displayAddress: _display, ...v1Snapshot } =
      snapshot as Record<string, unknown> & {
        presentation?: unknown;
        displayAddress?: unknown;
      };
    const outcome = resolveHistoricalSpeicherReport({
      requestedId: CALC_ID,
      row: rowFromInsert({
        result_schema_version: SPEICHER_GRENZE_RESULT_SCHEMA_VERSION_V1,
        result_snapshot: v1Snapshot,
      }),
    });
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.report.displayAddress).toBe(
      "Musterstraße 1, 80331 München",
    );
    expect(outcome.report.presentationOverride).toBeNull();
    expect(outcome.report.verifiedResult.energy.year.pvYieldKwhAnnual).toBe(
      9500,
    );
    expect(outcome.report.input.annualConsumptionKwh).toBe(4000);
  });

  it("uses stored v2 presentation values", () => {
    const mapped = mapCompletedCalculation({
      userId: USER_ID,
      input,
      payload,
    });
    const snapshot = {
      ...(mapped.result_snapshot as Record<string, unknown>),
      presentation: {
        recommendedTechnicalSize: 5,
        recommendedPlanningSize: 12,
      },
    };
    const outcome = resolveHistoricalSpeicherReport({
      requestedId: CALC_ID,
      row: rowFromInsert({ result_snapshot: snapshot }),
    });
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.report.presentationOverride).toEqual({
      recommendedTechnicalSize: 5,
      recommendedPlanningSize: 12,
    });
    expect(outcome.report.displayAddress).toBe(
      "Musterstraße 1, 80331 München",
    );
  });

  it("handles an unknown schema version without rerunning physics", () => {
    const outcome = resolveHistoricalSpeicherReport({
      requestedId: CALC_ID,
      row: rowFromInsert({
        result_schema_version: "speicher-grenze-result/v99",
      }),
    });
    expect(outcome).toEqual({
      status: "incompatible",
      createdAt: "2026-09-01T10:00:00.000Z",
      batteryModelVersion: "1.1.0",
      resultSchemaVersion: "speicher-grenze-result/v99",
      inputSchemaVersion: "speicher-grenze-input/v1",
    });
  });

  it("treats an invalid UUID as not found", () => {
    expect(
      resolveHistoricalSpeicherReport({
        requestedId: "not-a-uuid",
        row: rowFromInsert(),
      }).status,
    ).toBe("not_found");
  });

  it("treats a missing row as not found", () => {
    expect(
      resolveHistoricalSpeicherReport({
        requestedId: CALC_ID,
        row: null,
      }).status,
    ).toBe("not_found");
  });

  it("treats a wrong product_key as not found", () => {
    expect(
      resolveHistoricalSpeicherReport({
        requestedId: CALC_ID,
        row: rowFromInsert({ product_key: "pvshadow" }),
      }).status,
    ).toBe("not_found");
  });
});

describe("historical reader has no physics rerun path", () => {
  it("does not import calculation or PVGIS entry points", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "historicalSpeicherReport.ts"),
      "utf8",
    );
    expect(source).not.toContain("runHouseholdCalculation");
    expect(source).not.toContain("geocodeAddress");
    expect(source).not.toContain("loadHourlyPvByYear");
    expect(source).not.toContain("simulateMultiYearSpeicherGrenz");
    expect(source).not.toContain("calculateSpeicherResult(");
  });
});
