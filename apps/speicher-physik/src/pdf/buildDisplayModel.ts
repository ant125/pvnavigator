/**
 * Display model for one stored calculation.
 * Reads the saved input and result snapshot only. Does not run the physics
 * model and does not look at the live form.
 */
import { METHODOLOGY_PRINCIPLES } from "@pv-methodology/registry";

import type { PvSurfaceInput } from "@/app/(speicher)/types/speicher";
import { deriveSpeicherBusinessMetrics } from "@/lib/deriveSpeicherBusinessMetrics";
import {
  formatQuantityDe,
  formatQuantityWithUnit,
} from "@/lib/formatQuantityDe";
import {
  resolveHistoricalSpeicherReport,
  type CalculationHistoryRow,
} from "@/lib/historicalSpeicherReport";
import type { ReportEvCitation, ReportHeatPumpCitation } from "@/lib/reportMethodologySources";
import { getReportMethodologySources } from "@/lib/reportMethodologySources";
import {
  BDEW_STANDARDPROFIL_HINT,
  HOUSEHOLD_ROBUSTNESS_QUESTION,
  ROBUSTNESS_OVERVIEW_TITLE,
  anonymizedProfileLabel,
  formatOptionalReportKwh,
  formatOptionalReportPct,
  formatReportKwh,
  formatReportPct,
  formatReportRangeKwh,
  formatReportRangePct,
  householdOverviewSentence,
  householdRobustnessExplanation,
  robustnessKpiFollow,
  robustnessStabilityNote,
  technicalSizeRangeLead,
} from "@/lib/robustnessReportCopy";
import { PLANNING_REMAINING_CAPACITY_FRACTION } from "@/lib/speicherRecommendation";
import { buildSpeicherBenefitComparison } from "@/lib/speicherBenefitComparison";
import type { WpuqRobustnessPayload } from "@/lib/wpuqRobustnessStats";

import { buildFactChips, buildInputRows, buildSceneConfig, type InputFacts } from "./inputFacts";
import { PDF_HOUSE_IMAGE } from "./pdfAssets";
import type { PdfModel } from "./reportDocument";

const PLACEHOLDER = "—";
const Y_TICK_STEP_KWH = 500;
const Y_TICK_MAX_INTERVALS = 5;

export class PdfSourceError extends Error {
  constructor() {
    super(
      "Dieser gespeicherte Bericht kann mit der aktuellen Version nicht als PDF erstellt werden.",
    );
    this.name = "PdfSourceError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function formatKwh(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatQuantityWithUnit(value, "kWh", 0)
    : PLACEHOLDER;
}

function formatKwhPerYear(value: number | null | undefined, digits = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatQuantityWithUnit(value, "kWh/Jahr", digits)
    : PLACEHOLDER;
}

function formatRoundedKwhPerYear(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatQuantityWithUnit(Math.round(value), "kWh/Jahr")
    : PLACEHOLDER;
}

function formatPct(value: number | null) {
  return value !== null ? formatQuantityWithUnit(value, "%") : PLACEHOLDER;
}

function buildYAxisScale(values: number[]) {
  if (values.length === 0) {
    return { min: 0, max: 1, ticks: [] as number[] };
  }
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const step =
    Math.max(
      1,
      Math.ceil((rawMax - rawMin) / (Y_TICK_MAX_INTERVALS * Y_TICK_STEP_KWH)),
    ) * Y_TICK_STEP_KWH;
  const min = Math.floor(rawMin / step) * step;
  const max = Math.max(Math.ceil(rawMax / step) * step, min + step);
  const ticks: number[] = [];
  for (let value = min; value <= max + 1e-6; value += step) ticks.push(value);
  return { min, max, ticks };
}

function atSize(
  map: Record<string, number> | undefined,
  size: number,
): number | undefined {
  if (!map) return undefined;
  const value = map[size] ?? map[String(size)];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseSurface(value: unknown): PvSurfaceInput | null {
  if (!isRecord(value)) return null;
  const systemSizeKwP = asFiniteNumber(value.systemSizeKwP);
  const tiltDeg = asFiniteNumber(value.tiltDeg);
  const azimuthDeg = asFiniteNumber(value.azimuthDeg);
  if (
    systemSizeKwP === undefined ||
    tiltDeg === undefined ||
    azimuthDeg === undefined
  ) {
    return null;
  }
  return { systemSizeKwP, tiltDeg, azimuthDeg };
}

/**
 * Stored roofs only. A missing angle is left out; it is not replaced with a
 * default tilt or azimuth.
 */
function parseStoredSurfaces(input: Record<string, unknown>): PvSurfaceInput[] {
  if (Array.isArray(input.pvSurfaces) && input.pvSurfaces.length > 0) {
    return input.pvSurfaces
      .map(parseSurface)
      .filter((row): row is PvSurfaceInput => row !== null);
  }
  const tiltDeg = asFiniteNumber(input.tiltDeg);
  const azimuthDeg = asFiniteNumber(input.azimuthDeg);
  const systemSizeKwP = asFiniteNumber(input.pvSystemKwP);
  if (
    tiltDeg === undefined ||
    azimuthDeg === undefined ||
    systemSizeKwP === undefined
  ) {
    return [];
  }
  return [{ systemSizeKwP, tiltDeg, azimuthDeg }];
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function heatPumpTechnology(
  value: unknown,
): "luftwasser" | "wasserwasser" | undefined {
  return value === "luftwasser" || value === "wasserwasser" ? value : undefined;
}

function heatPumpDhw(
  value: unknown,
): "space_heat_only" | "space_heat_and_dhw" | undefined {
  return value === "space_heat_only" || value === "space_heat_and_dhw"
    ? value
    : undefined;
}

function heatPumpCitation(
  snapshot: Record<string, unknown>,
): ReportHeatPumpCitation {
  if (!isRecord(snapshot.heatPump)) return null;
  const methodologySourceId = snapshot.heatPump.methodologySourceId;
  return {
    methodologySourceId:
      typeof methodologySourceId === "string" ? methodologySourceId : null,
  };
}

function evCitation(snapshot: Record<string, unknown>): ReportEvCitation {
  if (!isRecord(snapshot.ev) || !Array.isArray(snapshot.ev.methodologySourceIds)) {
    return null;
  }
  const methodologySourceIds = snapshot.ev.methodologySourceIds.filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  return methodologySourceIds.length > 0 ? { methodologySourceIds } : null;
}

function savedAtLabel(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return PLACEHOLDER;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function robustnessModel(
  robustness: WpuqRobustnessPayload | null,
  technicalPrimary: number,
  eigenverbrauchsquoteMitSpeicherPct: number | null,
  autarkieMitPct: number | null,
): PdfModel["robustness"] & {
  householdSummary: string;
  profileTitle: string;
  profileRows: PdfModel["profiles"]["rows"];
} {
  if (!robustness) {
    return {
      householdSummary: PLACEHOLDER,
      profileTitle: "Einzelergebnisse der Haushaltsprofile",
      profileRows: [],
      lead: PLACEHOLDER,
      follow: null,
      question: HOUSEHOLD_ROBUSTNESS_QUESTION,
      hint: BDEW_STANDARDPROFIL_HINT,
      explanation: [],
      appendixCount: null,
      stability: PLACEHOLDER,
      compare: {
        primaryLabel: "Hauptrechnung · BDEW H25",
        rangeLabel: PLACEHOLDER,
        rows: [
          {
            label: "Technische Speichergrenze",
            primary: formatOptionalReportKwh(technicalPrimary),
            range: PLACEHOLDER,
          },
          {
            label: "Eigenverbrauchsquote",
            primary: formatOptionalReportPct(eigenverbrauchsquoteMitSpeicherPct),
            range: PLACEHOLDER,
          },
          {
            label: "Autarkie",
            primary: formatOptionalReportPct(autarkieMitPct),
            range: PLACEHOLDER,
          },
        ],
      },
      distribution: [],
    };
  }

  const profileCount =
    typeof robustness.cohortSize === "number" &&
    Number.isFinite(robustness.cohortSize) &&
    robustness.cohortSize > 0
      ? robustness.cohortSize
      : null;
  const sizeRows = [...robustness.sizeFrequency]
    .filter(
      (item) =>
        typeof item.sizeKwh === "number" &&
        Number.isFinite(item.sizeKwh) &&
        typeof item.householdCount === "number" &&
        Number.isFinite(item.householdCount),
    )
    .sort((a, b) => a.sizeKwh - b.sizeKwh);
  const sizeMax = Math.max(1, ...sizeRows.map((item) => item.householdCount));
  const houses = Array.isArray(robustness.houses) ? robustness.houses : [];

  return {
    householdSummary: householdOverviewSentence({
      cohortSize: robustness.cohortSize,
      technicalSizeMinKwh: robustness.ranges.technicalSpeichergrenzeKwh.min,
      technicalSizeMaxKwh: robustness.ranges.technicalSpeichergrenzeKwh.max,
    }),
    profileTitle: profileCount
      ? `Einzelergebnisse der ${profileCount} Haushaltsprofile`
      : "Einzelergebnisse der Haushaltsprofile",
    profileRows: houses.map((house, index) => ({
      profil: anonymizedProfileLabel(index),
      size:
        typeof house.technicalSpeichergrenzeKwh === "number" &&
        Number.isFinite(house.technicalSpeichergrenzeKwh)
          ? `${house.technicalSpeichergrenzeKwh} kWh`
          : PLACEHOLDER,
      eigenverbrauch:
        typeof house.eigenverbrauchKwh === "number" &&
        Number.isFinite(house.eigenverbrauchKwh)
          ? formatReportKwh(house.eigenverbrauchKwh)
          : PLACEHOLDER,
      autarkie:
        typeof house.autarkiePct === "number" && Number.isFinite(house.autarkiePct)
          ? formatReportPct(house.autarkiePct)
          : PLACEHOLDER,
    })),
    lead: technicalSizeRangeLead(
      robustness.ranges.technicalSpeichergrenzeKwh.min,
      robustness.ranges.technicalSpeichergrenzeKwh.max,
      "Haushaltsprofile",
    ),
    follow: robustnessKpiFollow(robustness),
    question: HOUSEHOLD_ROBUSTNESS_QUESTION,
    hint: BDEW_STANDARDPROFIL_HINT,
    explanation: householdRobustnessExplanation(robustness.cohortSize),
    appendixCount: profileCount,
    stability: robustnessStabilityNote(robustness, "Profile"),
    compare: {
      primaryLabel: "Hauptrechnung · BDEW H25",
      rangeLabel: `${robustness.cohortSize} reale Haushaltsprofile`,
      rows: [
        {
          label: "Technische Speichergrenze",
          primary: formatOptionalReportKwh(technicalPrimary),
          range: formatReportRangeKwh(
            robustness.ranges.technicalSpeichergrenzeKwh.min,
            robustness.ranges.technicalSpeichergrenzeKwh.max,
          ),
        },
        {
          label: "Eigenverbrauchsquote",
          primary: formatOptionalReportPct(eigenverbrauchsquoteMitSpeicherPct),
          range: formatReportRangePct(
            robustness.ranges.eigenverbrauchsquotePct.min,
            robustness.ranges.eigenverbrauchsquotePct.max,
          ),
        },
        {
          label: "Autarkie",
          primary: formatOptionalReportPct(autarkieMitPct),
          range: formatReportRangePct(
            robustness.ranges.autarkiePct.min,
            robustness.ranges.autarkiePct.max,
          ),
        },
      ],
    },
    distribution: sizeRows.map((item) => ({
      label: `${formatQuantityDe(item.sizeKwh)} kWh`,
      count: `${formatQuantityDe(item.householdCount)} ${item.householdCount === 1 ? "Haushalt" : "Haushalte"}`,
      width: (item.householdCount / sizeMax) * 100,
    })),
  };
}

export function buildSpeicherPdfModel(row: CalculationHistoryRow): PdfModel {
  const outcome = resolveHistoricalSpeicherReport({
    requestedId: row.id,
    row,
  });
  if (outcome.status !== "ok") {
    throw new PdfSourceError();
  }

  if (!isRecord(row.input) || !isRecord(row.result_snapshot)) {
    throw new PdfSourceError();
  }

  const input = row.input;
  const snapshot = row.result_snapshot;
  const report = outcome.report;
  const surfaces = parseStoredSurfaces(input);
  const storedTotalKwP = asFiniteNumber(input.pvSystemKwP);
  const totalKwP =
    storedTotalKwP ??
    (surfaces.length > 0
      ? surfaces.reduce((sum, surface) => sum + surface.systemSizeKwP, 0)
      : undefined);

  const heatPumpEnabled = optionalBoolean(input.heatPumpEnabled);
  const evRecord = isRecord(input.ev) ? input.ev : null;
  const evEnabled = evRecord ? optionalBoolean(evRecord.enabled) : undefined;
  const evAnnualKm = evRecord ? asFiniteNumber(evRecord.annualKm) : undefined;
  const backupReserveKwh =
    asFiniteNumber(input.backupReserveKwh) ??
    asFiniteNumber(report.verifiedResult.backupReserveKwh);
  const annualConsumptionKWh = asFiniteNumber(input.annualConsumptionKWh);
  const displayAddress =
    asString(snapshot.displayAddress)?.trim() ||
    asString(input.displayAddress)?.trim() ||
    "";

  const evAverageHomeChargedKwh = isRecord(snapshot.ev)
    ? asFiniteNumber(snapshot.ev.averageHomeChargedKwh)
    : undefined;

  const metrics = deriveSpeicherBusinessMetrics({
    verifiedResult: report.verifiedResult,
    speicherGrenz: report.speicherGrenz,
    annualConsumptionKwh: annualConsumptionKWh,
    heatPumpEnabled,
    heatPumpConsumptionKwh: asFiniteNumber(input.heatPumpConsumptionKWh),
    evEnabled,
    evAverageHomeChargedKwh,
    backupReserveKwh,
    totalKwPConfigured: totalKwP ?? 0,
    presentationOverride: report.presentationOverride,
  });

  const {
    recommendedTechnicalSize,
    recommendedPlanningSize,
    physicalKpiLookupSize,
    planningExceedsSimulatedRange,
    eigenverbrauchOhneSpeicher,
    eigenverbrauchMitSpeicher,
    autarkieOhneUnroundedPct,
    autarkieMitUnroundedPct,
    autarkieMitPct,
    pvYieldKwhAnnual,
    specificYieldKwhPerKwp,
    netzbezugMitSpeicherKwhYear,
    einspeisungRechnerischKwhYear,
    eigenverbrauchsquoteMitSpeicherPct,
    batteryGeladenAvgKwh,
    batteryAnVerbrauchAvgKwh,
    batterieverlusteModellGesamtKwh,
    avgSelfDischargeLossDisplayKwh,
    avgAuxiliaryConsumptionDisplayKwh,
  } = metrics;

  const benefit = buildSpeicherBenefitComparison({
    eigenverbrauchOhneKwh: eigenverbrauchOhneSpeicher,
    eigenverbrauchMitKwh: eigenverbrauchMitSpeicher,
    autarkieOhneUnroundedPct,
    autarkieMitUnroundedPct,
  });

  const visible = metrics.chart.data.filter((point) => point.size > 0);
  const yScale = buildYAxisScale(visible.map((point) => point.eigenverbrauch));
  const markerIndex = visible.findIndex(
    (point) => point.size === recommendedTechnicalSize,
  );

  const planningQuotient =
    recommendedTechnicalSize / PLANNING_REMAINING_CAPACITY_FRACTION;
  const planningQuotientIsInteger =
    Math.abs(planningQuotient - Math.round(planningQuotient)) < 1e-9;
  const fractionLabel = formatQuantityDe(PLANNING_REMAINING_CAPACITY_FRACTION, 2);
  const formulaExpression = planningQuotientIsInteger
    ? `${formatQuantityWithUnit(recommendedTechnicalSize, "kWh")} / ${fractionLabel} = ${formatQuantityWithUnit(recommendedPlanningSize, "kWh")}`
    : `${formatQuantityWithUnit(recommendedTechnicalSize, "kWh")} / ${fractionLabel} = ${formatQuantityWithUnit(planningQuotient, "kWh", 2)} → ${formatQuantityWithUnit(recommendedPlanningSize, "kWh")}`;

  const lookup = physicalKpiLookupSize;
  const speicherGrenz = report.speicherGrenz as unknown as Record<string, Record<string, number>>;
  const chargePv = atSize(speicherGrenz.averageChargeLossPvToBatteryKwh, lookup);
  const chargeChemical = atSize(speicherGrenz.averageChargeLossChemicalKwh, lookup);
  const showLossBreakdown =
    lookup > 0 &&
    batterieverlusteModellGesamtKwh !== null &&
    [chargePv, chargeChemical].some(
      (value) => typeof value === "number" && value > 1e-3,
    );

  const inputFacts: InputFacts = {
    displayAddress: displayAddress || PLACEHOLDER,
    totalKwP,
    surfaces,
    backupReserveKwh,
    annualConsumptionKWh,
    heatPumpEnabled,
    heatPumpConsumptionKWh: asFiniteNumber(input.heatPumpConsumptionKWh),
    heatPumpTechnology: heatPumpTechnology(input.heatPumpTechnology),
    heatPumpDhwService: heatPumpDhw(input.heatPumpDhwService),
    evEnabled,
    evAnnualKm,
  };

  const robustness = robustnessModel(
    report.robustness,
    recommendedTechnicalSize,
    eigenverbrauchsquoteMitSpeicherPct,
    autarkieMitPct,
  );
  const sources = getReportMethodologySources(
    heatPumpCitation(snapshot),
    evCitation(snapshot),
  );
  const sceneConfig = buildSceneConfig(inputFacts);

  return {
    savedAt: savedAtLabel(row.created_at),
    batteryModelVersion: row.battery_model_version,
    address: displayAddress || PLACEHOLDER,
    technical: {
      value: formatQuantityDe(recommendedTechnicalSize),
      unit: "kWh",
      caption: "Nutzbare Kapazität heute.",
    },
    planning: {
      value: formatQuantityDe(recommendedPlanningSize),
      unit: "kWh",
      caption: "Für die Kaufplanung bei angenommenen 75 % Restkapazität",
    },
    robustnessOverviewTitle: ROBUSTNESS_OVERVIEW_TITLE,
    householdSummary: robustness.householdSummary,
    benefit: {
      scaleEnd:
        benefit.scaleMaxKwh === null
          ? PLACEHOLDER
          : formatQuantityWithUnit(benefit.scaleMaxKwh, "kWh/Jahr"),
      ohneLabel: formatKwh(benefit.ohne.raw),
      mitLabel: formatKwh(benefit.mit.raw),
      ohneFill: benefit.ohne.fillPercent,
      mitFill: benefit.mit.fillPercent,
      gain: `Rund ${
        benefit.gainKwhRounded === null
          ? `${PLACEHOLDER} kWh`
          : formatQuantityWithUnit(benefit.gainKwhRounded, "kWh")
      } mehr selbst genutzt / Jahr`,
      autarkieOhne: formatPct(benefit.autarkieOhne.displayPct),
      autarkieMit: formatPct(benefit.autarkieMit.displayPct),
      solarOhne: benefit.autarkieOhne.solarPercent,
      solarMit: benefit.autarkieMit.solarPercent,
      grid: `Rund ${
        benefit.gridShareWithStorageRoundedPct === null
          ? `${PLACEHOLDER} %`
          : formatQuantityWithUnit(benefit.gridShareWithStorageRoundedPct, "%")
      } kommen noch aus dem Netz`,
      zeroPct: formatQuantityWithUnit(0, "%"),
      fullPct: `${formatQuantityWithUnit(100, "%")} Ihres Strombedarfs`,
    },
    overviewNote:
      recommendedTechnicalSize > 0
        ? "Eigenverbrauch und Autarkie beziehen sich auf die technische Speichergrenze."
        : null,
    basisNote: "Berechnungsgrundlage: BDEW H25",
    scene: {
      src: PDF_HOUSE_IMAGE,
      caption: "Schematische Darstellung, nicht die Geometrie Ihres Gebäudes.",
      ...sceneConfig,
    },
    layoutTest: null,
    chips: buildFactChips(inputFacts),
    inputs: buildInputRows(inputFacts),
    chart: {
      points: visible.map((point) => ({
        size: point.size,
        eigenverbrauch: point.eigenverbrauch,
        label: formatQuantityDe(point.size, 0),
      })),
      yMin: yScale.min,
      yMax: yScale.max,
      yTicks: yScale.ticks.map((tick) => ({
        value: tick,
        label: formatQuantityDe(tick, 0),
      })),
      markerSize: recommendedTechnicalSize,
      markerIndex,
      markerAnchor:
        markerIndex <= 0
          ? "start"
          : markerIndex === visible.length - 1
            ? "end"
            : markerIndex < visible.length * 0.28
              ? "start"
              : "middle",
      lead: `Die technische Speichergrenze liegt bei ${formatQuantityWithUnit(recommendedTechnicalSize, "kWh")}. Oberhalb dieses Punktes nimmt der zusätzliche Eigenverbrauch nur noch gering zu.`,
      ageing:
        "Für die Kaufplanung wird zusätzlich eine pauschale Alterungsreserve berücksichtigt. Dabei wird angenommen, dass nach einem Planungszeitraum von etwa 10 Jahren noch 75 % der anfänglichen nutzbaren Kapazität verfügbar sind.",
      formulaLabel: "Planerische Anfangskapazität",
      formulaExpression,
      formulaRounding: "Auf volle kWh aufgerundet.",
      xAxisLabel: "Speicherkapazität (kWh)",
      yAxisLabel: "Eigenverbrauch (kWh/Jahr)",
      caveat: `Die 75-%-Annahme ist keine Prognose für einen bestimmten Batteriespeicher und keine Herstellergarantie. Sie beeinflusst ausschließlich die planerische Kaufempfehlung. Die technische Simulation und sämtliche technischen Kennzahlen werden weiterhin mit der technischen Speichergrenze von ${recommendedTechnicalSize} kWh berechnet.`,
      planningExceedsSimulatedRange,
    },
    robustness,
    balance: {
      helper: `Alle technischen Kennzahlen beziehen sich auf die technische Speichergrenze von ${recommendedTechnicalSize} kWh und nicht auf die planerische Kaufempfehlung.`,
      rowsLeft: [
        {
          label: "Jahresertrag PV",
          value: formatKwhPerYear(pvYieldKwhAnnual, 0),
        },
        {
          label: "Spezifischer Ertrag",
          value:
            specificYieldKwhPerKwp !== null
              ? formatQuantityWithUnit(specificYieldKwhPerKwp, "kWh/kWp", 1)
              : PLACEHOLDER,
        },
        {
          label: "Direktverbrauch ohne Speicher",
          value: formatKwh(
            report.verifiedResult.energy.year.selfConsumptionWithoutStorage,
          ),
        },
        {
          label: "Eigenverbrauch mit Speicher",
          value: formatKwh(eigenverbrauchMitSpeicher),
          accent: true,
        },
        {
          label: "PV-Energie zur Batterieladung",
          help: "PV-Überschuss vor den modellierten Ladeverlusten.",
          value: formatRoundedKwhPerYear(batteryGeladenAvgKwh),
        },
        {
          label: "Batterie → Haushalt (AC)",
          help: "An den Haushalt gelieferte Energie nach den modellierten Entladeverlusten.",
          value: formatRoundedKwhPerYear(batteryAnVerbrauchAvgKwh),
        },
      ],
      rowsRight: [
        {
          label: "Systemverbrauch Standby",
          help: "Gesamter Eigenbedarf des Speichersystems; kann durch PV, Batterie oder Netz gedeckt werden. Separat bilanziert; nicht im Haushaltsverbrauch, Eigenverbrauch oder Autarkiegrad enthalten.",
          value: formatRoundedKwhPerYear(avgAuxiliaryConsumptionDisplayKwh),
        },
        {
          label: "Netzbezug Haushalt mit Speicher",
          help: "Nur Netzbezug des Haushalts; Netzbezug des Speichersystems ist nicht enthalten.",
          value: formatKwhPerYear(netzbezugMitSpeicherKwhYear, 0),
        },
        {
          label: "Modellierte Netzeinspeisung",
          help: "Verbleibender PV-Überschuss am AC-Bus nach Haushaltsverbrauch, Systemverbrauch und Batterieladung. Keine Abbildung von EEG-Abrechnung oder realem Zählerverhalten.",
          value: formatKwhPerYear(einspeisungRechnerischKwhYear, 0),
        },
        {
          label: "Autarkiegrad mit Speicher",
          value: formatPct(autarkieMitPct),
          accent: true,
        },
        {
          label: "Eigenverbrauchsquote",
          value: formatPct(eigenverbrauchsquoteMitSpeicherPct),
        },
      ],
      losses: showLossBreakdown
        ? {
            total: formatRoundedKwhPerYear(batterieverlusteModellGesamtKwh),
            note: "Summe aus Lade-, Entladeverlusten und Selbstentladung (Mehrjahresmittel). Einzelne gerundete Komponenten können vom gerundeten Gesamtwert um 1 kWh abweichen.",
            items: [
              {
                label: "PV → Speicher",
                value: formatRoundedKwhPerYear(chargePv),
              },
              {
                label: "Zellverluste beim Laden",
                value: formatRoundedKwhPerYear(chargeChemical),
              },
              {
                label: "Zellverluste beim Entladen",
                value: formatRoundedKwhPerYear(
                  atSize(speicherGrenz.averageDischargeLossChemicalKwh, lookup),
                ),
              },
              {
                label: "Speicher → AC-Bus",
                value: formatRoundedKwhPerYear(
                  atSize(speicherGrenz.averageDischargeLossBatteryToAcKwh, lookup),
                ),
              },
              {
                label: "Selbstentladung",
                value: formatRoundedKwhPerYear(avgSelfDischargeLossDisplayKwh),
              },
            ],
          }
        : null,
    },
    methodik: {
      principles: [...METHODOLOGY_PRINCIPLES],
      assessment: [
        "Die technische Speichergrenze wird ausschließlich anhand der physikalischen Simulation berechnet.",
        "Die planerische Kaufempfehlung berücksichtigt zusätzlich eine einheitliche Alterungsreserve. Sie ist keine Prognose der tatsächlichen Batteriealterung und keine Herstellergarantie.",
        `Die Berechnung basiert auf einer Simulation in 15-Minuten-Schritten (${formatQuantityDe(35040)} Zeitschritte pro Jahr). Die 75-%-Planungsannahme beeinflusst die Simulation nicht, sondern ausschließlich die planerische Kaufempfehlung.`,
      ],
      quellenIntro:
        "Die ausführliche Dokumentation steht unter Methodik. Hier nur die Quellen, die dieser Bericht verwendet.",
      methodikUrl: "https://speicher.pvnavigator.de/methodik",
      sources: sources.map((source) => ({
        title: source.title,
        detail: source.detail,
        organization: source.organization,
        linkLabel: source.linkLabel,
        url: source.url,
      })),
      disclaimer:
        "Dies ist eine vereinfachte Ersteinschätzung auf Basis Ihrer Angaben. Die tatsächliche Wirtschaftlichkeit hängt von vielen weiteren Faktoren ab (Lastprofil, Stromtarif, Fördermittel, etc.). Für eine detaillierte Analyse empfehlen wir eine individuelle Beratung.",
    },
    profiles: {
      title: robustness.profileTitle,
      headers: ["Profil", "Speichergröße", "Eigenverbrauch", "Autarkie"],
      rows: robustness.profileRows,
    },
  };
}
