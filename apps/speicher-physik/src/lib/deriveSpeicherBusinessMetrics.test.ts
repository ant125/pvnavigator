import { describe, expect, it } from "vitest";
import { BATTERY_MODEL_VERSION } from "../../../../packages/pv-core";
import type { SpeicherGrenzPayload } from "./calculateSpeicherResult";
import {
  deriveSpeicherBusinessMetrics,
  type DeriveSpeicherBusinessMetricsInput,
  type SpeicherVerifiedResultInput,
} from "./deriveSpeicherBusinessMetrics";

function emptySpeicherGrenz(
  overrides: Partial<SpeicherGrenzPayload> = {}
): SpeicherGrenzPayload {
  return {
    batterySizes: [],
    average: {},
    averageBatteryChargedKwh: {},
    averageBatteryDischargedKwh: {},
    averageDirectPvToHouseholdKwh: {},
    averageDirectPvToAuxiliaryKwh: {},
    averageBatteryToHouseholdKwh: {},
    averageBatteryToAuxiliaryKwh: {},
    averageGridToHouseholdKwh: {},
    averageGridToAuxiliaryKwh: {},
    averageGridExportKwh: {},
    averageAuxiliaryConsumptionKwh: {},
    averageChargeLossKwh: {},
    averageDischargeLossKwh: {},
    averageChargeLossPvToBatteryKwh: {},
    averageChargeLossChemicalKwh: {},
    averageDischargeLossChemicalKwh: {},
    averageDischargeLossBatteryToAcKwh: {},
    averageSocStartKwh: {},
    averageSocEndKwh: {},
    averageSocEndPct: {},
    averageEnergyBalanceErrorKwh: {},
    averageSelfDischargeLossKwh: {},
    averageSelfConsumptionWithoutStorageKwh: 0,
    averagePvYieldKwhAnnual: 0,
    averageLoadKwhAnnual: 0,
    batteryModelVersion: BATTERY_MODEL_VERSION,
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<DeriveSpeicherBusinessMetricsInput> = {}
): DeriveSpeicherBusinessMetricsInput {
  return {
    verifiedResult: null,
    speicherGrenz: null,
    annualConsumptionKwh: undefined,
    heatPumpEnabled: false,
    heatPumpConsumptionKwh: undefined,
    backupReserveKwh: undefined,
    totalKwPConfigured: 0,
    ...overrides,
  };
}

function verified(
  selfConsumptionWithoutStorage: number,
  pvYieldKwhAnnual: number,
  backupReserveKwh?: number
): SpeicherVerifiedResultInput {
  return {
    energy: {
      year: { selfConsumptionWithoutStorage, pvYieldKwhAnnual },
    },
    ...(backupReserveKwh !== undefined ? { backupReserveKwh } : {}),
  };
}

describe("deriveSpeicherBusinessMetrics", () => {
  it("1. null state — empty verifiedResult and speicherGrenz", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({ backupReserveKwh: 2 })
    );

    expect(result.chart.data).toEqual([
      { size: 0, eigenverbrauch: 0, deltaEigenverbrauch: 0 },
    ]);
    expect(result.recommendedTechnicalSize).toBe(0);
    expect(result.recommendedPlanningSize).toBe(0);
    expect(result.physicalKpiLookupSize).toBe(0);
    expect(result.recommendedEV).toBe(0);
    expect(result.batteryGeladenAvgKwh).toBeUndefined();
    expect(result.autarkieOhnePct).toBeNull();
    expect(result.autarkieMitPct).toBeNull();
    expect(result.deltaAutarkiePctPoints).toBeNull();
    expect(result.deltaEigenverbrauch).toBeNull();
    expect(result.netzbezugMitSpeicherKwhYear).toBe(0);
    expect(result.einspeisungRechnerischKwhYear).toBeNull();
    expect(result.eigenverbrauchsquoteMitSpeicherPct).toBeNull();
    expect(result.resolvedBackupReserveKwh).toBe(2);
  });

  it("2. chart + recommendation plateau — delta drops below 50 at size 7", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3000, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [5, 6, 7],
          average: { 5: 3120, 6: 3170, 7: 3200 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.recommendedTechnicalSize).toBe(6);
    expect(result.recommendedPlanningSize).toBe(8);
    expect(result.physicalKpiLookupSize).toBe(6);
    expect(result.recommendedEV).toBe(3170);
  });

  it("3. planning exceeds simulated range — technical 23 → planning 31", () => {
    const averages: Record<number, number> = {};
    for (let s = 5; s <= 23; s++) {
      averages[s] = 3000 + s * 100;
    }
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3000, 10000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: Array.from({ length: 19 }, (_, i) => i + 5),
          average: averages,
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.recommendedTechnicalSize).toBe(23);
    expect(result.recommendedPlanningSize).toBe(31);
    expect(result.planningExceedsSimulatedRange).toBe(true);
  });

  it("4. autarkie rounding — ohne=3200, mit=4100, total=5000", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.autarkieOhnePct).toBe(64);
    expect(result.autarkieMitPct).toBe(82);
    expect(result.deltaEigenverbrauch).toBe(900);
    expect(result.deltaAutarkiePctPoints).toBe(18);
  });

  it("4b. ΔAutarkie from unrounded ratios — differs from round(A)−round(B)", () => {
    // ohne 2520/5000 = 50.4% → 50; mit 3230/5000 = 64.6% → 65;
    // round(65)−round(50)=15, but round((3230−2520)/5000×100)=round(14.2)=14
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(2520, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 3230 },
          averageLoadKwhAnnual: 5000,
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.autarkieOhnePct).toBe(50);
    expect(result.autarkieMitPct).toBe(65);
    expect(result.autarkieMitPct! - result.autarkieOhnePct!).toBe(15);
    expect(result.deltaAutarkiePctPoints).toBe(14);
  });

  it("5. ledger-first netzbezug — finite averageGridToHouseholdKwh", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
          averageGridToHouseholdKwh: { 6: 1234.7 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.netzbezugMitSpeicherKwhYear).toBe(1234.7);
  });

  it("6. netzbezug fallback — ledger import missing", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.netzbezugMitSpeicherKwhYear).toBe(900);
  });

  it("7. einspeisung ledger-first — finite averageGridExportKwh", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
          averageGridExportKwh: { 6: 567.3 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.einspeisungRechnerischKwhYear).toBe(567.3);
    expect(result.ledgerGridExportAvgKwh).toBe(567.3);
  });

  it("8. einspeisung — missing ledger export yields null (no PV−EV fallback)", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    // Would have been 8000 − 4100 = 3900 under the old PV−Eigenverbrauch fallback
    expect(result.einspeisungRechnerischKwhYear).toBeNull();
    expect(result.ledgerGridExportAvgKwh).toBeUndefined();
  });

  it("8b. einspeisung — non-finite ledger export yields null", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
          averageGridExportKwh: { 6: Number.NaN },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.einspeisungRechnerischKwhYear).toBeNull();
  });

  it("9. Batterieverluste gesamt — charge + discharge + Selbstentladung (unrounded sum)", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
          averageChargeLossKwh: { 6: 120.4 },
          averageDischargeLossKwh: { 6: 80.6 },
          averageSelfDischargeLossKwh: { 6: 15.3 },
          averageAuxiliaryConsumptionKwh: { 6: 131.4 },
          averageGridToHouseholdKwh: { 6: 900 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    // 120.4 + 80.6 + 15.3 = 216.3 → 216; standby/grid import not included
    expect(result.batterieverlusteModellGesamtKwh).toBe(216);
    expect(result.avgAuxiliaryConsumptionDisplayKwh).toBe(131.4);
    expect(result.netzbezugMitSpeicherKwhYear).toBe(900);
  });

  it("9b. Batterieverluste gesamt — round only final total (components would sum differently)", () => {
    // Individually: round(10.4)+round(10.4)+round(10.4)=30; unrounded sum 31.2 → 31
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
          averageChargeLossKwh: { 6: 10.4 },
          averageDischargeLossKwh: { 6: 10.4 },
          averageSelfDischargeLossKwh: { 6: 10.4 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(
      Math.round(10.4) + Math.round(10.4) + Math.round(10.4)
    ).toBe(30);
    expect(result.batterieverlusteModellGesamtKwh).toBe(31);
  });

  it("9c. Batterieverluste gesamt — missing Selbstentladung → null (no partial total)", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
          averageChargeLossKwh: { 6: 120.4 },
          averageDischargeLossKwh: { 6: 80.6 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.batterieverlusteModellGesamtKwh).toBeNull();
  });

  it("9d. physical KPIs use technical Speichergrenze lookup size", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3000, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [5, 6, 7],
          average: { 5: 3120, 6: 3170, 7: 3200 },
          averageBatteryChargedKwh: { 5: 100, 6: 200, 7: 300 },
          averageBatteryToHouseholdKwh: { 5: 80, 6: 160, 7: 240 },
          averageGridExportKwh: { 5: 50, 6: 60, 7: 70 },
          averageChargeLossKwh: { 5: 10, 6: 20, 7: 30 },
          averageDischargeLossKwh: { 5: 5, 6: 10, 7: 15 },
          averageSelfDischargeLossKwh: { 5: 1, 6: 2, 7: 3 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    // Plateau: delta at 7 is 30 < 50 → technical = 6 (not planning 8)
    expect(result.recommendedTechnicalSize).toBe(6);
    expect(result.recommendedPlanningSize).toBe(8);
    expect(result.physicalKpiLookupSize).toBe(6);
    expect(result.batteryGeladenAvgKwh).toBe(200);
    expect(result.batteryAnVerbrauchAvgKwh).toBe(160);
    expect(result.einspeisungRechnerischKwhYear).toBe(60);
    expect(result.batterieverlusteModellGesamtKwh).toBe(32);
  });

  it("10. eigenverbrauchsquote — pvYield=8000, mit=5600", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 5600 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.eigenverbrauchsquoteMitSpeicherPct).toBe(70);
  });

  it("11. specific yield — pvYield=9000, totalKwP=10", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 9000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.specificYieldKwhPerKwp).toBe(900);
  });

  it("12. backup reserve resolution — verified wins over form", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000, 2),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
        }),
        backupReserveKwh: 1.5,
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.resolvedBackupReserveKwh).toBe(2);
  });

  it("13. heat pump totalConsumption — house 4000 + HP 2000", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3200, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [6],
          average: { 6: 4100 },
        }),
        annualConsumptionKwh: 4000,
        heatPumpEnabled: true,
        heatPumpConsumptionKwh: 2000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.totalConsumption).toBe(6000);
  });

  it("14. lookup size 0 — all physical KPI lookups undefined", () => {
    const result = deriveSpeicherBusinessMetrics(
      baseInput({
        verifiedResult: verified(3000, 8000),
        speicherGrenz: emptySpeicherGrenz({
          batterySizes: [5],
          average: { 5: 3030 },
          averageBatteryChargedKwh: { 5: 500 },
          averageGridToHouseholdKwh: { 5: 100 },
        }),
        annualConsumptionKwh: 5000,
        totalKwPConfigured: 10,
      })
    );

    expect(result.recommendedTechnicalSize).toBe(0);
    expect(result.physicalKpiLookupSize).toBe(0);
    expect(result.batteryGeladenAvgKwh).toBeUndefined();
    expect(result.batteryAnVerbrauchAvgKwh).toBeUndefined();
    expect(result.ledgerGridImportAvgKwh).toBeUndefined();
    expect(result.avgChargeLossKwh).toBeUndefined();
  });
});
