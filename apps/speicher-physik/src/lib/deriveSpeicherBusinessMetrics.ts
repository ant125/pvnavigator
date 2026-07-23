import type { SpeicherGrenzPayload } from "./calculateSpeicherResult";
import {
  buildSpeicherChartData,
  type BuildSpeicherChartDataResult,
} from "./speicherChartData";
import {
  deriveRecommendedPlanningSize,
  deriveRecommendedTechnicalSize,
  getPhysicalKpiLookupSize,
  SIMULATED_BATTERY_MAX_KWH,
} from "./speicherRecommendation";

/** Matches VerifiedResult from verifiedResultStore — structural, no store import. */
export type SpeicherVerifiedResultInput = {
  energy: {
    year: {
      selfConsumptionWithoutStorage: number;
      pvYieldKwhAnnual: number;
    };
  };
  backupReserveKwh?: number;
};

export type DeriveSpeicherBusinessMetricsInput = {
  verifiedResult: SpeicherVerifiedResultInput | null;
  speicherGrenz: SpeicherGrenzPayload | null;
  /** Form fields used for totalConsumption and backup-reserve fallback. */
  annualConsumptionKwh: number | undefined;
  heatPumpEnabled: boolean | undefined;
  heatPumpConsumptionKwh: number | undefined;
  backupReserveKwh: number | undefined;
  /** From sumSurfaceKwP(surfaces) — computed in page, passed in. */
  totalKwPConfigured: number;
};

export type DeriveSpeicherBusinessMetricsOutput = {
  chart: BuildSpeicherChartDataResult;
  recommendedTechnicalSize: number;
  recommendedPlanningSize: number;
  physicalKpiLookupSize: number;
  planningExceedsSimulatedRange: boolean;
  recommendedEV: number | undefined;
  batteryGeladenAvgKwh: number | undefined;
  batteryAnVerbrauchAvgKwh: number | undefined;
  batteryTotalDischargedAvgKwh: number | undefined;
  avgChargeLossKwh: number | undefined;
  avgDischargeLossKwh: number | undefined;
  batterieverlusteModellGesamtKwh: number | null;
  avgSelfDischargeLossDisplayKwh: number | undefined;
  avgAuxiliaryConsumptionDisplayKwh: number | undefined;
  totalConsumption: number;
  eigenverbrauchOhneSpeicher: number | undefined;
  eigenverbrauchMitSpeicher: number | undefined;
  autarkieOhnePct: number | null;
  autarkieMitPct: number | null;
  deltaEigenverbrauch: number | null;
  resolvedBackupReserveKwh: number;
  pvYieldKwhAnnual: number | undefined;
  specificYieldKwhPerKwp: number | null;
  ledgerGridImportAvgKwh: number | undefined;
  ledgerGridExportAvgKwh: number | undefined;
  netzbezugMitSpeicherKwhYear: number | null;
  einspeisungRechnerischKwhYear: number | null;
  eigenverbrauchsquoteMitSpeicherPct: number | null;
};

export function deriveSpeicherBusinessMetrics(
  input: DeriveSpeicherBusinessMetricsInput
): DeriveSpeicherBusinessMetricsOutput {
  const { verifiedResult, speicherGrenz } = input;

  const chart = buildSpeicherChartData({
    selfConsumptionWithoutStorage:
      speicherGrenz && verifiedResult
        ? verifiedResult.energy.year.selfConsumptionWithoutStorage
        : 0,
    batterySizes: speicherGrenz?.batterySizes ?? [],
    average: speicherGrenz?.average ?? {},
  });

  const recommendedTechnicalSize = deriveRecommendedTechnicalSize({
    data: chart.data,
  });
  const recommendedPlanningSize = deriveRecommendedPlanningSize(
    recommendedTechnicalSize
  );
  const physicalKpiLookupSize = getPhysicalKpiLookupSize(
    recommendedTechnicalSize
  );
  const planningExceedsSimulatedRange =
    recommendedPlanningSize > SIMULATED_BATTERY_MAX_KWH;

  const recommendedEV = chart.data.find(
    (p) => p.size === physicalKpiLookupSize
  )?.eigenverbrauch;

  const batteryGeladenAvgKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? speicherGrenz.averageBatteryChargedKwh[physicalKpiLookupSize]
      : undefined;
  const batteryAnVerbrauchAvgKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? speicherGrenz.averageBatteryToHouseholdKwh[physicalKpiLookupSize]
      : undefined;
  const batteryTotalDischargedAvgKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? speicherGrenz.averageBatteryDischargedKwh[physicalKpiLookupSize]
      : undefined;

  const avgChargeLossKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? speicherGrenz.averageChargeLossKwh[physicalKpiLookupSize]
      : undefined;
  const avgDischargeLossKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? speicherGrenz.averageDischargeLossKwh[physicalKpiLookupSize]
      : undefined;
  const batterieverlusteModellGesamtKwh =
    typeof avgChargeLossKwh === "number" &&
    Number.isFinite(avgChargeLossKwh) &&
    typeof avgDischargeLossKwh === "number" &&
    Number.isFinite(avgDischargeLossKwh)
      ? Math.round(avgChargeLossKwh + avgDischargeLossKwh)
      : null;

  const avgSelfDischargeLossDisplayKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? speicherGrenz.averageSelfDischargeLossKwh[physicalKpiLookupSize]
      : undefined;
  const avgAuxiliaryConsumptionDisplayKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? speicherGrenz.averageAuxiliaryConsumptionKwh[physicalKpiLookupSize]
      : undefined;

  const totalConsumption =
    (input.annualConsumptionKwh ?? 0) +
    (input.heatPumpEnabled === true
      ? input.heatPumpConsumptionKwh ?? 0
      : 0);

  const eigenverbrauchOhneSpeicher =
    verifiedResult?.energy.year.selfConsumptionWithoutStorage;
  const eigenverbrauchMitSpeicher = recommendedEV;

  const autarkieOhnePct =
    totalConsumption > 0 &&
    typeof eigenverbrauchOhneSpeicher === "number" &&
    Number.isFinite(eigenverbrauchOhneSpeicher)
      ? Math.round((eigenverbrauchOhneSpeicher / totalConsumption) * 100)
      : null;

  const autarkieMitPct =
    totalConsumption > 0 &&
    typeof eigenverbrauchMitSpeicher === "number" &&
    Number.isFinite(eigenverbrauchMitSpeicher)
      ? Math.round((eigenverbrauchMitSpeicher / totalConsumption) * 100)
      : null;

  const deltaEigenverbrauch =
    typeof eigenverbrauchMitSpeicher === "number" &&
    Number.isFinite(eigenverbrauchMitSpeicher) &&
    typeof eigenverbrauchOhneSpeicher === "number" &&
    Number.isFinite(eigenverbrauchOhneSpeicher)
      ? Math.round(
          eigenverbrauchMitSpeicher - eigenverbrauchOhneSpeicher
        )
      : null;

  const resolvedBackupReserveKwh =
    verifiedResult?.backupReserveKwh ?? input.backupReserveKwh ?? 0;

  const pvYieldKwhAnnual = verifiedResult?.energy.year.pvYieldKwhAnnual;

  const totalKwPConfigured = input.totalKwPConfigured;

  const specificYieldKwhPerKwp =
    typeof pvYieldKwhAnnual === "number" &&
    Number.isFinite(pvYieldKwhAnnual) &&
    totalKwPConfigured > 0 &&
    Number.isFinite(totalKwPConfigured)
      ? pvYieldKwhAnnual / totalKwPConfigured
      : null;

  const ledgerGridImportAvgKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? speicherGrenz.averageGridToHouseholdKwh[physicalKpiLookupSize]
      : undefined;
  const ledgerGridExportAvgKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? speicherGrenz.averageGridExportKwh[physicalKpiLookupSize]
      : undefined;

  const netzbezugMitSpeicherKwhYear =
    typeof ledgerGridImportAvgKwh === "number" &&
    Number.isFinite(ledgerGridImportAvgKwh)
      ? ledgerGridImportAvgKwh
      : typeof eigenverbrauchMitSpeicher === "number" &&
          Number.isFinite(eigenverbrauchMitSpeicher) &&
          Number.isFinite(totalConsumption)
        ? totalConsumption - eigenverbrauchMitSpeicher
        : null;

  const einspeisungRechnerischKwhYear =
    typeof ledgerGridExportAvgKwh === "number" &&
    Number.isFinite(ledgerGridExportAvgKwh)
      ? ledgerGridExportAvgKwh
      : typeof pvYieldKwhAnnual === "number" &&
          Number.isFinite(pvYieldKwhAnnual) &&
          typeof eigenverbrauchMitSpeicher === "number" &&
          Number.isFinite(eigenverbrauchMitSpeicher)
        ? pvYieldKwhAnnual - eigenverbrauchMitSpeicher
        : null;

  const eigenverbrauchsquoteMitSpeicherPct =
    typeof pvYieldKwhAnnual === "number" &&
    pvYieldKwhAnnual > 0 &&
    typeof eigenverbrauchMitSpeicher === "number" &&
    Number.isFinite(eigenverbrauchMitSpeicher)
      ? Math.round((eigenverbrauchMitSpeicher / pvYieldKwhAnnual) * 100)
      : null;

  return {
    chart,
    recommendedTechnicalSize,
    recommendedPlanningSize,
    physicalKpiLookupSize,
    planningExceedsSimulatedRange,
    recommendedEV,
    batteryGeladenAvgKwh,
    batteryAnVerbrauchAvgKwh,
    batteryTotalDischargedAvgKwh,
    avgChargeLossKwh,
    avgDischargeLossKwh,
    batterieverlusteModellGesamtKwh,
    avgSelfDischargeLossDisplayKwh,
    avgAuxiliaryConsumptionDisplayKwh,
    totalConsumption,
    eigenverbrauchOhneSpeicher,
    eigenverbrauchMitSpeicher,
    autarkieOhnePct,
    autarkieMitPct,
    deltaEigenverbrauch,
    resolvedBackupReserveKwh,
    pvYieldKwhAnnual,
    specificYieldKwhPerKwp,
    ledgerGridImportAvgKwh,
    ledgerGridExportAvgKwh,
    netzbezugMitSpeicherKwhYear,
    einspeisungRechnerischKwhYear,
    eigenverbrauchsquoteMitSpeicherPct,
  };
}
