import { describe, expect, it } from "vitest";
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
  });

  it("8. einspeisung fallback — export missing", () => {
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

    expect(result.einspeisungRechnerischKwhYear).toBe(3900);
  });

  it("9. battery losses sum — charge=120.4, discharge=80.6", () => {
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

    expect(result.batterieverlusteModellGesamtKwh).toBe(201);
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
