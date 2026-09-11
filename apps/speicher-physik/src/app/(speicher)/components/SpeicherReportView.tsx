"use client";

import Link from "next/link";
import type { RefObject } from "react";

import type { PvSurfaceInput } from "../types/speicher";
import {
  type HouseholdCalculationPayload,
  type SpeicherGrenzPayload,
  type VerifiedResult,
  type WpuqRobustnessPayload,
  type WwRobustnessPayload,
} from "../calculate/actions";
import { deriveSpeicherBusinessMetrics } from "@/lib/deriveSpeicherBusinessMetrics";
import SpeicherChart from "@/components/SpeicherChart";
import {
  ReportQuellenSection,
  WpuqRobustnessSection,
} from "../calculate/WpuqRobustnessSection";
import {
  SMART_METER_HOUSEHOLD_COUNT,
  formatCalculationDurationDe,
} from "@/lib/calculationProgress";
import {
  getReportDurationInclusions,
  type ReportHeatPumpCitation,
} from "@/lib/reportMethodologySources";
import { EvResultSection } from "../calculate/EvResultSection";
import { EV_REPORT_COPY, formatEvKwh } from "@/lib/evReportPresentation";
import type { FrozenSpeicherPresentation } from "@/lib/persistCompletedCalculation";

const PLACEHOLDER = "—";

const HEAT_PUMP_TECHNOLOGY_LABELS = {
  luftwasser: "Luft/Wasser",
  wasserwasser: "Wasser/Wasser",
} as const;

const HEAT_PUMP_DHW_LABELS = {
  space_heat_and_dhw: "Heizung und Warmwasser",
  space_heat_only: "Nur Heizung",
} as const;

const REPORT_SHEET =
  "mx-auto min-w-0 w-full max-w-sheet rounded-lg border border-line bg-surface p-5 sm:p-8 lg:p-10";

/**
 * Major section boundary inside the sheet: one rule with symmetric space above
 * and below, so every section transition carries the same weight. Section
 * headings therefore need no rule of their own.
 */
const REPORT_SECTION = "mt-8 min-w-0 max-w-full border-t border-line pt-8 lg:mt-10 lg:pt-10";

/** Report-section heading — a document chapter, not a micro label. */
const REPORT_SECTION_HEADING = "text-lg font-semibold text-ink";

/** Micro label above a value or a form group. */
const REPORT_SECTION_TITLE =
  "text-xs font-semibold uppercase tracking-wide text-ink-secondary";

/** Label of a group nested inside a section — one step darker than a micro label. */
const REPORT_GROUP_TITLE =
  "text-xs font-semibold uppercase tracking-wide text-ink";

const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover";



/**
 * Main + aside split of a section: the primary result on the left, the
 * reference value and its caveats on the right, divided by a hairline.
 */
const REPORT_SPLIT = "grid gap-8 lg:grid-cols-[3fr_2fr] lg:gap-12";

const REPORT_SPLIT_ASIDE =
  "border-t border-line-soft pt-6 lg:border-t-0 lg:border-l lg:border-line-soft lg:pt-0 lg:pl-8";

/**
 * Two side-by-side metric/comparison tracks. Each track is an independent
 * closed table, so the report width carries two columns of metrics instead of
 * one long single-column list.
 */
const REPORT_TWO_TRACKS = "grid gap-x-12 gap-y-8 lg:grid-cols-2";

/** One metric/comparison track: a closed table of label/value rows. */
const REPORT_METRIC_LIST =
  "divide-y divide-line-soft border-y border-line-soft text-sm";

/** Metric row: label left, value aligned to the right edge of its track. */
const REPORT_METRIC_ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 py-3";

const REPORT_METRIC_LABEL = "min-w-0 leading-snug text-ink-secondary";

const REPORT_METRIC_VALUE =
  "shrink-0 text-right tabular-nums font-medium text-ink";

const REPORT_METRIC_VALUE_ACCENT =
  "shrink-0 text-right tabular-nums font-semibold text-accent-text";

/**
 * Stammdaten datasheet: short label above its value, three columns on desktop,
 * so a small dataset stays horizontally compact instead of vertically long.
 */
const REPORT_DATA_GRID = "grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3";

const REPORT_DATA_ITEM = "border-t border-line-soft pt-3";

const REPORT_DATA_LABEL = "text-xs leading-snug text-ink-muted";

const REPORT_DATA_VALUE = "mt-1 text-sm font-medium tabular-nums text-ink";

/**
 * Tinted technical band for a nested energy balance inside a section: the total
 * on top, its components below, all within one boundary so the components read
 * as parts of that total rather than as separate metrics.
 */
const REPORT_BAND =
  "mt-8 rounded-md border border-line-soft bg-surface-muted p-5 lg:p-6";

const REPORT_BAND_GRID =
  "mt-5 grid gap-x-8 gap-y-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3";

/**
 * Written conclusion of the report: prose on the left, key figures in the
 * split aside. Hierarchy comes from colour and spacing within the prose track.
 */
const REPORT_CONCLUSION_BODY = "text-sm leading-relaxed text-ink";

const REPORT_CONCLUSION_CONTEXT = "text-sm leading-relaxed text-ink-secondary";

/** Methodological note closing the conclusion — demoted footnote prose. */
const REPORT_NOTE = "text-xs leading-relaxed text-ink-muted";

const SPEICHER_REPORT_HELPER_TEXT =
  "text-xs leading-snug text-ink-muted font-normal normal-case";

function formatKwpDisplay(n: number): string {
  if (!Number.isFinite(n)) return "";
  return parseFloat((Math.round(n * 100) / 100).toFixed(2)).toString();
}

function formatSavedAtDe(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export type SpeicherReportViewMode = "live" | "historical";

export type SpeicherReportViewProps = {
  mode: SpeicherReportViewMode;
  verifiedResult: VerifiedResult | null;
  speicherGrenz: SpeicherGrenzPayload | null;
  robustness: WpuqRobustnessPayload | null;
  wasserWasserRobustness: WwRobustnessPayload | null;
  ev: HouseholdCalculationPayload["ev"];
  heatPumpCitation: ReportHeatPumpCitation;
  displayAddress: string | null;
  surfaces: PvSurfaceInput[];
  input: {
    annualConsumptionKwh: number | undefined;
    heatPumpEnabled: boolean | undefined;
    heatPumpConsumptionKwh: number | undefined;
    heatPumpTechnology?: "luftwasser" | "wasserwasser";
    heatPumpDhwService?: "space_heat_only" | "space_heat_and_dhw";
    evEnabled?: boolean;
    backupReserveKwh?: number;
  };
  totalKwPConfigured: number;
  presentationOverride?: FrozenSpeicherPresentation | null;
  calculationDurationMs?: number | null;
  savedAt?: string | null;
  batteryModelVersion?: string | null;
  mastheadRef?: RefObject<HTMLDivElement | null>;
};

export function SpeicherReportView({
  mode,
  verifiedResult,
  speicherGrenz,
  robustness,
  wasserWasserRobustness,
  ev,
  heatPumpCitation,
  displayAddress,
  surfaces,
  input,
  totalKwPConfigured,
  presentationOverride = null,
  calculationDurationMs = null,
  savedAt = null,
  batteryModelVersion = null,
  mastheadRef,
}: SpeicherReportViewProps) {
  const metrics = deriveSpeicherBusinessMetrics({
    verifiedResult,
    speicherGrenz,
    annualConsumptionKwh: input.annualConsumptionKwh,
    heatPumpEnabled: input.heatPumpEnabled,
    heatPumpConsumptionKwh: input.heatPumpConsumptionKwh,
    evEnabled: input.evEnabled === true,
    evAverageHomeChargedKwh: ev?.averageHomeChargedKwh,
    backupReserveKwh: input.backupReserveKwh,
    totalKwPConfigured,
    presentationOverride,
  });

  const {
    chart,
    recommendedTechnicalSize,
    recommendedPlanningSize,
    physicalKpiLookupSize,
    planningExceedsSimulatedRange,
    recommendedEV,
    batteryGeladenAvgKwh,
    batteryAnVerbrauchAvgKwh,
    batterieverlusteModellGesamtKwh,
    avgSelfDischargeLossDisplayKwh,
    avgAuxiliaryConsumptionDisplayKwh,
    eigenverbrauchMitSpeicher,
    autarkieOhnePct,
    autarkieMitPct,
    deltaAutarkiePctPoints,
    deltaEigenverbrauch,
    resolvedBackupReserveKwh,
    pvYieldKwhAnnual,
    specificYieldKwhPerKwp,
    netzbezugMitSpeicherKwhYear,
    einspeisungRechnerischKwhYear,
    eigenverbrauchsquoteMitSpeicherPct,
  } = metrics;

  const hybridChargeBreakdownAvgKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? (speicherGrenz.averageChargeLossPvToBatteryKwh[physicalKpiLookupSize] ??
          0) +
        (speicherGrenz.averageChargeLossChemicalKwh[physicalKpiLookupSize] ?? 0)
      : 0;
  const showBatterieverlusteHybridBreakdown =
    speicherGrenz != null &&
    physicalKpiLookupSize > 0 &&
    batterieverlusteModellGesamtKwh !== null &&
    hybridChargeBreakdownAvgKwh > 1e-3;

  const hasActiveBackupReserve =
    typeof resolvedBackupReserveKwh === "number" &&
    Number.isFinite(resolvedBackupReserveKwh) &&
    resolvedBackupReserveKwh > 0;

  const formatKwh = (value: number | null | undefined) =>
    typeof value === "number" ? `${value.toFixed(0)} kWh` : PLACEHOLDER;

  return (
        <div className="mx-auto min-w-0 w-full max-w-frame px-4 sm:px-6 lg:px-8">
          <div className={REPORT_SHEET}>
            {/* Masthead — title block of the report sheet */}
            <div ref={mastheadRef} className="scroll-mt-20">
              <div className="flex items-center gap-1.5">
                <svg
                  className="h-4 w-4 shrink-0 text-accent-text"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">
                  {mode === "historical"
                    ? "Gespeicherter Bericht"
                    : "Analyse abgeschlossen"}
                </span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
                Ihre Speicher-Analyse
              </h1>
              {mode === "historical" ? (
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  Gespeichert am{" "}
                  {savedAt ? formatSavedAtDe(savedAt) : PLACEHOLDER}
                  {batteryModelVersion ? (
                    <>
                      {" "}
                      · Modellversion {batteryModelVersion}
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>

            {/* Recommended Size */}
            <section className={REPORT_SECTION}>
              <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
                Berechnung nach BDEW H25
              </h2>
              {recommendedTechnicalSize > 0 ? (
                /*
                  One composition instead of a headline grid stacked on a second
                  grid: the purchase-planning result and its derivation form the
                  main column, the physical reference value and its caveats the
                  aside. The planning value therefore outranks the technical one
                  typographically while both stay visibly related.
                */
                <div className={REPORT_SPLIT}>
                  <div className="space-y-6">
                    <div>
                      <p className={REPORT_SECTION_TITLE}>
                        Planerische Kaufempfehlung
                      </p>
                      <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-ink">
                        {recommendedPlanningSize} kWh
                      </p>
                    </div>

                    <div className="space-y-4 text-sm leading-relaxed text-ink-secondary">
                      <p>
                        Die physikalische Simulation ermittelt für die heutigen
                        Bedingungen eine technische Speichergrenze von{" "}
                        <strong className="font-semibold text-ink">
                          {recommendedTechnicalSize} kWh nutzbarer Kapazität
                        </strong>
                        .
                      </p>
                      <p>
                        Für die Kaufplanung wird zusätzlich eine pauschale
                        Alterungsreserve berücksichtigt. Dabei wird angenommen,
                        dass nach einem Planungszeitraum von etwa 10 Jahren
                        noch 75&nbsp;% der anfänglichen nutzbaren Kapazität
                        verfügbar sind.
                      </p>
                      <p className="rounded-md border border-line-soft bg-surface-muted px-4 py-3 font-medium tabular-nums text-ink">
                        Planerische Anfangskapazität = ⌈{" "}
                        {recommendedTechnicalSize} kWh / 0,75 ⌉ ={" "}
                        {recommendedPlanningSize} kWh
                      </p>
                    </div>
                  </div>

                  <div className={`${REPORT_SPLIT_ASIDE} space-y-4`}>
                    <div>
                      <p className={REPORT_SECTION_TITLE}>
                        Technische Speichergrenze heute:
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                        {recommendedTechnicalSize} kWh
                      </p>
                    </div>
                    <p className="text-xs italic leading-relaxed text-ink-muted">
                      Die 75-%-Annahme ist keine Prognose für einen bestimmten
                      Batteriespeicher und keine Herstellergarantie. Sie
                      beeinflusst ausschließlich die planerische
                      Kaufempfehlung. Die technische Simulation und sämtliche
                      technischen Kennzahlen werden weiterhin mit der
                      technischen Speichergrenze von{" "}
                      {recommendedTechnicalSize} kWh berechnet.
                    </p>
                    {planningExceedsSimulatedRange && (
                      <p className="rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning">
                        Die planerische Anfangskapazität liegt außerhalb des
                        simulierten Speicherbereichs von 5–30 kWh.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-reading">
                  <p className={REPORT_SECTION_TITLE}>Speicherempfehlung</p>
                  <p className="mt-2 text-lg font-semibold leading-relaxed text-ink">
                    Unter den aktuellen Annahmen ist kein Batteriespeicher
                    technisch erforderlich.
                  </p>
                </div>
              )}
            </section>

            {/*
              Two comparison groups instead of a four-tile strip: each group
              reads "ohne Speicher" (left) → "mit Speicher" (right, accented,
              with its delta), separated by a hairline.
            */}
            <section className={`${REPORT_SECTION} ${REPORT_TWO_TRACKS}`}>
              <div>
                <h3 className={`mb-3 ${REPORT_GROUP_TITLE}`}>
                  Eigenverbrauch
                </h3>
                <div className={REPORT_METRIC_LIST}>
                  <div className={REPORT_METRIC_ROW}>
                    <span className={REPORT_METRIC_LABEL}>
                      Eigenverbrauch ohne Speicher (jährlich)
                    </span>
                    <span className="shrink-0 text-right text-base font-medium tabular-nums text-ink">
                      {formatKwh(
                        verifiedResult?.energy.year
                          .selfConsumptionWithoutStorage
                      )}
                    </span>
                  </div>
                  <div className={REPORT_METRIC_ROW}>
                    <span className={REPORT_METRIC_LABEL}>
                      Eigenverbrauch mit Speicher
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-semibold tabular-nums text-accent-text">
                        {formatKwh(recommendedEV)}
                      </span>
                      {deltaEigenverbrauch !== null && (
                        <span className="mt-0.5 block text-xs font-medium tabular-nums text-success">
                          ({deltaEigenverbrauch >= 0 ? "+" : ""}
                          {deltaEigenverbrauch} kWh)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`mb-3 ${REPORT_GROUP_TITLE}`}>Autarkie</h3>
                <div className={REPORT_METRIC_LIST}>
                  <div className={REPORT_METRIC_ROW}>
                    <span className={REPORT_METRIC_LABEL}>
                      Autarkie ohne Speicher:
                    </span>
                    <span className="shrink-0 text-right text-base font-medium tabular-nums text-ink">
                      {autarkieOhnePct !== null
                        ? `${autarkieOhnePct} %`
                        : PLACEHOLDER}
                    </span>
                  </div>
                  <div className={REPORT_METRIC_ROW}>
                    <span className={REPORT_METRIC_LABEL}>
                      Autarkie mit Speicher:
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-semibold tabular-nums text-accent-text">
                        {autarkieMitPct !== null
                          ? `${autarkieMitPct} %`
                          : PLACEHOLDER}
                      </span>
                      {deltaAutarkiePctPoints !== null && (
                        <span className="mt-0.5 block text-xs font-medium tabular-nums text-success">
                          ({deltaAutarkiePctPoints >= 0 ? "+" : ""}
                          {deltaAutarkiePctPoints} Prozentpunkte)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {speicherGrenz && (
              <>
                <section className={REPORT_SECTION}>
                    <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
                      Ihre Eingabedaten
                    </h2>

                    {/*
                      Stammdaten as a datasheet grid: label above value, so a
                      short dataset reads across the report width instead of
                      running down a long two-column table.
                    */}
                    <dl className={REPORT_DATA_GRID}>
                      <div className={`${REPORT_DATA_ITEM} sm:col-span-2`}>
                        <dt className={REPORT_DATA_LABEL}>Adresse:</dt>
                        <dd
                          className={`${REPORT_DATA_VALUE} break-words whitespace-normal`}
                        >
                          {displayAddress ?? PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>PV-Anlage:</dt>
                        <dd className={REPORT_DATA_VALUE}>
                          <span>
                            {Number.isFinite(totalKwPConfigured)
                              ? formatKwpDisplay(totalKwPConfigured)
                              : PLACEHOLDER}{" "}
                            kWp
                          </span>
                          {surfaces.length > 1 && (
                            <span className="text-ink-secondary font-normal">{` auf ${surfaces.length} Dachflächen`}</span>
                          )}
                          {surfaces.length > 1 && (
                            <div className={`mt-2 ${SPEICHER_REPORT_HELPER_TEXT} space-y-1`}>
                              {surfaces.map((s, i) => (
                                <div key={i}>
                                  Dachfläche {i + 1}: {Number.isFinite(s.systemSizeKwP) ? formatKwpDisplay(s.systemSizeKwP) : PLACEHOLDER} kWp,
                                  {" "}{s.tiltDeg}°, {s.azimuthDeg}°
                                </div>
                              ))}
                            </div>
                          )}
                        </dd>
                      </div>

                      {surfaces.length === 1 && (
                        <>
                          <div className={REPORT_DATA_ITEM}>
                            <dt className={REPORT_DATA_LABEL}>Neigung:</dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {surfaces[0]?.tiltDeg}°
                            </dd>
                          </div>

                          <div className={REPORT_DATA_ITEM}>
                            <dt className={REPORT_DATA_LABEL}>
                              Ausrichtung:
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {surfaces[0]?.azimuthDeg}°
                            </dd>
                          </div>
                        </>
                      )}

                      {hasActiveBackupReserve && (
                        <div className={REPORT_DATA_ITEM}>
                          <dt className={REPORT_DATA_LABEL}>
                            Notstromreserve:
                          </dt>
                          <dd className={REPORT_DATA_VALUE}>
                            {resolvedBackupReserveKwh} kWh
                          </dd>
                        </div>
                      )}

                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>
                          {ev != null
                            ? `${EV_REPORT_COPY.householdLoad}:`
                            : "Hausverbrauch (ohne Wärmepumpe):"}
                        </dt>
                        <dd className={REPORT_DATA_VALUE}>
                          {input.annualConsumptionKwh} kWh/Jahr
                        </dd>
                      </div>

                      {input.heatPumpEnabled === true && (
                        <>
                          <div className={REPORT_DATA_ITEM}>
                            <dt className={REPORT_DATA_LABEL}>
                              {EV_REPORT_COPY.heatPumpLoad}:
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {input.heatPumpConsumptionKwh} kWh/Jahr
                            </dd>
                          </div>
                          {(input.heatPumpTechnology === "luftwasser" ||
                            input.heatPumpTechnology === "wasserwasser") && (
                            <div className={REPORT_DATA_ITEM}>
                              <dt className={REPORT_DATA_LABEL}>
                                Typ:
                              </dt>
                              <dd className={REPORT_DATA_VALUE}>
                                {
                                  HEAT_PUMP_TECHNOLOGY_LABELS[
                                    input.heatPumpTechnology
                                  ]
                                }
                              </dd>
                            </div>
                          )}
                          {input.heatPumpDhwService && (
                            <div className={REPORT_DATA_ITEM}>
                              <dt className={REPORT_DATA_LABEL}>
                                Verwendung:
                              </dt>
                              <dd className={REPORT_DATA_VALUE}>
                                {
                                  HEAT_PUMP_DHW_LABELS[
                                    input.heatPumpDhwService
                                  ]
                                }
                              </dd>
                            </div>
                          )}
                        </>
                      )}

                      {ev != null && (
                        <div className={REPORT_DATA_ITEM}>
                          <dt className={REPORT_DATA_LABEL}>
                            {EV_REPORT_COPY.evHomeLoad}:
                          </dt>
                          <dd className={REPORT_DATA_VALUE}>
                            {formatEvKwh(ev.averageHomeChargedKwh)}
                            /Jahr
                          </dd>
                        </div>
                      )}

                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>
                          {ev != null
                            ? `${EV_REPORT_COPY.modelledLoadTotal}:`
                            : "Gesamtverbrauch:"}
                        </dt>
                        <dd className={REPORT_DATA_VALUE}>
                          <div>
                            {ev != null &&
                            typeof speicherGrenz.averageLoadKwhAnnual ===
                              "number" &&
                            Number.isFinite(speicherGrenz.averageLoadKwhAnnual)
                              ? `${formatEvKwh(speicherGrenz.averageLoadKwhAnnual)}/Jahr`
                              : `${
                                  (input.annualConsumptionKwh ?? 0) +
                                  (input.heatPumpEnabled === true
                                    ? input.heatPumpConsumptionKwh ?? 0
                                    : 0)
                                } kWh/Jahr`}
                          </div>
                          {input.heatPumpEnabled === true && ev == null && (
                            <div className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-1`}>
                              davon Wärmepumpe: {input.heatPumpConsumptionKwh}{" "}
                              kWh
                            </div>
                          )}
                        </dd>
                      </div>
                    </dl>

                    {ev != null && <EvResultSection ev={ev} />}
                </section>

                <section className={REPORT_SECTION}>
                    <div className="mb-6">
                      <h2 className={REPORT_SECTION_HEADING}>
                        Technische Kennzahlen
                      </h2>
                      <p className="mt-2 max-w-reading text-xs leading-relaxed text-ink-muted">
                        Alle technischen Kennzahlen beziehen sich auf die
                        technische Speichergrenze von{" "}
                        <strong className="font-semibold text-ink-secondary">
                          {recommendedTechnicalSize} kWh
                        </strong>{" "}
                        und nicht auf die planerische Kaufempfehlung.
                      </p>
                    </div>

                    {/*
                      Two metric tracks: energy flow on the left, system, grid
                      and autarky on the right. The nested battery-loss balance
                      follows below as its own full-width band.
                    */}
                    <div className={REPORT_TWO_TRACKS}>
                    <dl className={REPORT_METRIC_LIST}>
                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Jahresertrag PV
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof pvYieldKwhAnnual === "number" &&
                          Number.isFinite(pvYieldKwhAnnual)
                            ? `${pvYieldKwhAnnual.toFixed(0)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Spezifischer Ertrag
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {specificYieldKwhPerKwp !== null
                            ? `${specificYieldKwhPerKwp.toFixed(1)} kWh/kWp`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Direktverbrauch ohne Speicher
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {formatKwh(
                            verifiedResult?.energy.year.selfConsumptionWithoutStorage
                          )}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Eigenverbrauch mit Speicher
                        </dt>
                        <dd className={REPORT_METRIC_VALUE_ACCENT}>
                          {formatKwh(eigenverbrauchMitSpeicher)}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          <span className="block leading-snug">
                            PV-Energie zur Batterieladung
                          </span>
                          <span
                            className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}
                          >
                            PV-Überschuss vor den modellierten Ladeverlusten.
                          </span>
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof batteryGeladenAvgKwh === "number" &&
                          Number.isFinite(batteryGeladenAvgKwh)
                            ? `${Math.round(batteryGeladenAvgKwh)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          <span className="block leading-snug">
                            Batterie → Haushalt (AC)
                          </span>
                          <span
                            className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}
                          >
                            An den Haushalt gelieferte Energie nach den
                            modellierten Entladeverlusten.
                          </span>
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof batteryAnVerbrauchAvgKwh === "number" &&
                          Number.isFinite(batteryAnVerbrauchAvgKwh)
                            ? `${Math.round(batteryAnVerbrauchAvgKwh)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>
                    </dl>

                    <dl className={REPORT_METRIC_LIST}>
                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          <span className="block leading-snug">
                            Systemverbrauch Standby
                          </span>
                          <span
                            className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}
                          >
                            Gesamter Eigenbedarf des Speichersystems; kann durch
                            PV, Batterie oder Netz gedeckt werden. Separat
                            bilanziert; nicht im Haushaltsverbrauch,
                            Eigenverbrauch oder Autarkiegrad enthalten.
                          </span>
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof avgAuxiliaryConsumptionDisplayKwh ===
                            "number" &&
                          Number.isFinite(avgAuxiliaryConsumptionDisplayKwh)
                            ? `${Math.round(avgAuxiliaryConsumptionDisplayKwh)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          <span className="block leading-snug">
                            Netzbezug Haushalt mit Speicher
                          </span>
                          <span
                            className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}
                          >
                            Nur Netzbezug des Haushalts einschließlich
                            Wärmepumpe; Netzbezug des Speichersystems ist nicht
                            enthalten.
                          </span>
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof netzbezugMitSpeicherKwhYear === "number" &&
                          Number.isFinite(netzbezugMitSpeicherKwhYear)
                            ? `${netzbezugMitSpeicherKwhYear.toFixed(0)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          <span className="block leading-snug">
                            Modellierte Netzeinspeisung
                          </span>
                          <span className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}>
                            Verbleibender PV-Überschuss am AC-Bus nach
                            Haushaltsverbrauch, Systemverbrauch und
                            Batterieladung. Keine Abbildung von EEG-Abrechnung
                            oder realem Zählerverhalten.
                          </span>
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof einspeisungRechnerischKwhYear === "number" &&
                          Number.isFinite(einspeisungRechnerischKwhYear)
                            ? `${einspeisungRechnerischKwhYear.toFixed(0)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Autarkiegrad mit Speicher
                        </dt>
                        <dd className={REPORT_METRIC_VALUE_ACCENT}>
                          {autarkieMitPct !== null
                            ? `${autarkieMitPct} %`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Eigenverbrauchsquote
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {eigenverbrauchsquoteMitSpeicherPct !== null
                            ? `${eigenverbrauchsquoteMitSpeicherPct} %`
                            : PLACEHOLDER}
                        </dd>
                      </div>
                    </dl>
                    </div>

                    {/*
                      Battery losses are a nested energy balance, not a single
                      metric: the total sits on top of the band and its
                      components fill a mini-grid inside the same boundary, so
                      they read as parts of that total.
                    */}
                    {speicherGrenz && showBatterieverlusteHybridBreakdown ? (
                      <div className={REPORT_BAND}>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6">
                          <div>
                            <span className="block text-sm font-semibold leading-snug text-ink">
                              Batterieverluste gesamt
                            </span>
                            <span
                              className={`mt-1 block max-w-reading ${SPEICHER_REPORT_HELPER_TEXT}`}
                            >
                              Summe aus Lade-, Entladeverlusten und
                              Selbstentladung (Mehrjahresmittel). Einzelne
                              gerundete Komponenten können vom gerundeten
                              Gesamtwert um 1&nbsp;kWh abweichen.
                            </span>
                          </div>
                          <div className="shrink-0 text-right text-lg font-semibold tabular-nums text-ink">
                            {batterieverlusteModellGesamtKwh !== null
                              ? `${batterieverlusteModellGesamtKwh} kWh/Jahr`
                              : PLACEHOLDER}
                          </div>
                        </div>

                        <dl className={REPORT_BAND_GRID}>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              PV → Speicher
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {Math.round(
                                speicherGrenz.averageChargeLossPvToBatteryKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}{" "}
                              kWh/Jahr
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Zellverluste beim Laden
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {Math.round(
                                speicherGrenz.averageChargeLossChemicalKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}{" "}
                              kWh/Jahr
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Zellverluste beim Entladen
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {Math.round(
                                speicherGrenz.averageDischargeLossChemicalKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}{" "}
                              kWh/Jahr
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Speicher → AC-Bus
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {Math.round(
                                speicherGrenz
                                  .averageDischargeLossBatteryToAcKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}{" "}
                              kWh/Jahr
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Selbstentladung
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {typeof avgSelfDischargeLossDisplayKwh ===
                                "number" &&
                              Number.isFinite(avgSelfDischargeLossDisplayKwh)
                                ? `${Math.round(avgSelfDischargeLossDisplayKwh)} kWh/Jahr`
                                : PLACEHOLDER}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ) : (
                      <div className="mt-8 border-t border-line-soft pt-4">
                        <div className={REPORT_METRIC_ROW}>
                          <div className={REPORT_METRIC_LABEL}>
                            <span className="block leading-snug">
                              Batterieverluste
                            </span>
                            <span
                              className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}
                            >
                              Für dieses Ergebnis liegt keine aufgeschlüsselte
                              Verlustbilanz vor.
                            </span>
                          </div>
                          <div className={REPORT_METRIC_VALUE}>
                            {PLACEHOLDER}
                          </div>
                        </div>
                      </div>
                    )}
                </section>

                <section className={REPORT_SECTION}>
                  <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
                    Eigenverbrauch vs Speichergröße
                  </h2>

                  <SpeicherChart
                    data={chart.data}
                    recommendedTechnicalSize={recommendedTechnicalSize}
                  />

                  <div className="mt-4 max-w-reading text-sm leading-relaxed text-ink-secondary">
                    Der zusätzliche Eigenverbrauch nimmt mit wachsender
                    Speichergröße deutlich ab. Ab einem bestimmten Punkt bringt
                    mehr Speicher nur noch geringen Mehrwert.
                  </div>
                </section>
              </>
            )}

            {robustness ? (
              <WpuqRobustnessSection
                robustness={robustness}
                wasserWasserRobustness={wasserWasserRobustness}
                bdew={{
                  technicalSpeichergrenzeKwh: recommendedTechnicalSize,
                  eigenverbrauchsquotePct: eigenverbrauchsquoteMitSpeicherPct,
                  autarkiePct: autarkieMitPct,
                }}
              />
            ) : null}

            {/*
              Written conclusion: prose argument on the left, compact key figures
              on the right (same split pattern as the recommendation section).
              Methodological notes and Hinweis stay full-width below.
            */}
            <section className={REPORT_SECTION}>
              <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
                Unsere Einschätzung
              </h2>
              {recommendedTechnicalSize > 0 ? (
                <>
                  <div className={REPORT_SPLIT}>
                    <div className="min-w-0">
                      {/* The result of the report, restated in one compact group. */}
                      <div className="space-y-3">
                        <p className={REPORT_CONCLUSION_BODY}>
                          Die planerische Kaufempfehlung für Ihr Gebäude beträgt{" "}
                          <strong className="font-semibold text-ink">
                            {recommendedPlanningSize} kWh
                          </strong>{" "}
                          (planerische Anfangskapazität).
                        </p>
                        <p className={REPORT_CONCLUSION_BODY}>
                          Die physikalische Simulation ermittelt eine technische
                          Speichergrenze von{" "}
                          <strong className="font-semibold text-ink">
                            {recommendedTechnicalSize} kWh nutzbarer Kapazität
                          </strong>
                          .
                        </p>
                        <p className={REPORT_CONCLUSION_CONTEXT}>
                          Die planerische Anfangskapazität von{" "}
                          <strong className="font-semibold text-ink">
                            {recommendedPlanningSize} kWh
                          </strong>{" "}
                          enthält zusätzlich eine pauschale Alterungsreserve
                          (Planungsannahme: ca. 75&nbsp;% Restkapazität nach etwa
                          10 Jahren).
                        </p>
                        {hasActiveBackupReserve && (
                          <p className={REPORT_CONCLUSION_CONTEXT}>
                            Die Berechnung berücksichtigt eine Notstromreserve von{" "}
                            {resolvedBackupReserveKwh} kWh.
                          </p>
                        )}
                      </div>

                      {/* Caveat on the result above — ruled, not boxed. */}
                      {planningExceedsSimulatedRange && (
                        <p className="mt-5 border-l-2 border-warning pl-5 text-sm leading-relaxed text-warning">
                          Die planerische Anfangskapazität liegt außerhalb des
                          simulierten Speicherbereichs von 5–30 kWh.
                        </p>
                      )}

                      {/* What the simulation adds, ending in the Plateau finding. */}
                      <p className={`mt-8 ${REPORT_CONCLUSION_CONTEXT}`}>
                        Gleichzeitig zeigt die Simulation:
                      </p>
                      <p className={`mt-1 ${REPORT_CONCLUSION_BODY}`}>
                        Ab etwa{" "}
                        <strong className="font-semibold text-ink">
                          {recommendedTechnicalSize} kWh
                        </strong>{" "}
                        nimmt der zusätzliche Nutzen deutlich ab.
                      </p>

                      <div className="mt-5 border-l-2 border-accent pl-5">
                        <p className="text-sm font-semibold text-accent-text">
                          Plateau erreicht
                        </p>
                        <p className={`mt-1.5 ${REPORT_CONCLUSION_BODY}`}>
                          Ab diesem Punkt bringt zusätzlicher Speicher nur noch
                          sehr geringen Mehrwert.
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                          Die technische Speichergrenze liegt unmittelbar vor dem
                          ersten weiteren Kapazitätsschritt, der den jährlichen
                          Eigenverbrauch um weniger als 50&nbsp;kWh erhöht.
                        </p>
                      </div>

                      {/* What that means in practice — run-in, not a pseudo-heading. */}
                      <p className={`mt-8 ${REPORT_CONCLUSION_BODY}`}>
                        <strong className="font-semibold">Das bedeutet:</strong>{" "}
                        Ein größerer Speicher wäre technisch möglich, würde unter
                        den heutigen Bedingungen jedoch nur einen geringen
                        zusätzlichen Nutzen bringen.
                      </p>
                    </div>

                    <dl className={`${REPORT_SPLIT_ASIDE} space-y-0`}>
                      <div className={`${REPORT_DATA_ITEM} lg:border-t-0 lg:pt-0`}>
                        <dt className={REPORT_DATA_LABEL}>
                          Planerische Kaufempfehlung
                        </dt>
                        <dd
                          className={`${REPORT_DATA_VALUE} font-semibold text-accent-text`}
                        >
                          {recommendedPlanningSize} kWh
                        </dd>
                      </div>
                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>
                          Technische Speichergrenze
                        </dt>
                        <dd className={REPORT_DATA_VALUE}>
                          {recommendedTechnicalSize} kWh
                        </dd>
                      </div>
                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>Plateau ab</dt>
                        <dd className={REPORT_DATA_VALUE}>
                          {recommendedTechnicalSize} kWh
                        </dd>
                      </div>
                      {hasActiveBackupReserve && (
                        <div className={REPORT_DATA_ITEM}>
                          <dt className={REPORT_DATA_LABEL}>Notstromreserve</dt>
                          <dd className={REPORT_DATA_VALUE}>
                            {resolvedBackupReserveKwh} kWh
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div className="mt-10 max-w-reading space-y-2.5 border-t border-line-soft pt-6">
                    <p className={REPORT_NOTE}>
                      Die technische Speichergrenze wird ausschließlich anhand
                      der physikalischen Simulation berechnet.
                    </p>
                    <p className={REPORT_NOTE}>
                      Die planerische Kaufempfehlung berücksichtigt zusätzlich
                      eine einheitliche Alterungsreserve. Sie ist keine Prognose
                      der tatsächlichen Batteriealterung und keine
                      Herstellergarantie.
                    </p>
                    <p className={REPORT_NOTE}>
                      Die Berechnung basiert auf einer Simulation in
                      15-Minuten-Schritten (35.040 Zeitschritte pro Jahr). Die
                      75-%-Planungsannahme
                      beeinflusst die Simulation nicht, sondern ausschließlich
                      die planerische Kaufempfehlung.
                    </p>
                    {hasActiveBackupReserve && (
                      <>
                        <p className={REPORT_NOTE}>
                          Durch die aktivierte Notstromreserve steht ein Teil
                          des Speichers im Alltag nicht zur Verfügung.
                        </p>
                        <p className={REPORT_NOTE}>
                          Dadurch sinken Eigenverbrauch und Autarkie leicht.
                        </p>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="max-w-reading text-sm leading-relaxed text-ink">
                  Unter den aktuellen Annahmen ist kein Batteriespeicher
                  technisch erforderlich. Die Simulation zeigt, dass ein
                  zusätzlicher Speicher den Eigenverbrauch unter diesen
                  Bedingungen kaum erhöht.
                </p>
              )}
            </section>

            <ReportQuellenSection
              heatPump={heatPumpCitation}
              ev={
                ev
                  ? {
                      methodologySourceIds: ev.methodologySourceIds,
                    }
                  : null
              }
            />

            {/* Disclaimer — closing footnote of the report, not a section */}
            <div className="mt-8 border-t border-line-soft pt-6 lg:mt-10">
              <p className="max-w-reading text-xs leading-relaxed text-ink-muted">
                <strong className="font-semibold text-ink-secondary">
                  Hinweis:
                </strong>{" "}
                Dies ist eine vereinfachte Ersteinschätzung auf Basis Ihrer
                Angaben. Die tatsächliche Wirtschaftlichkeit hängt von vielen
                weiteren Faktoren ab (Lastprofil, Stromtarif, Fördermittel,
                etc.). Für eine detaillierte Analyse empfehlen wir eine
                individuelle Beratung.
              </p>
              {calculationDurationMs !== null ? (
                <div className="mt-6 max-w-reading text-xs leading-relaxed text-ink-muted">
                  <p className="font-medium text-ink-secondary">
                    Berechnungsdauer
                  </p>
                  <p className="mt-0.5 tabular-nums">
                    {formatCalculationDurationDe(calculationDurationMs)}{" "}
                    Sekunden
                  </p>
                  <p className="mt-2">inkl.</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {getReportDurationInclusions({
                      heatPump: heatPumpCitation,
                      ev: ev
                        ? {
                            methodologySourceIds: ev.methodologySourceIds,
                          }
                        : null,
                      cohortSize:
                        robustness?.cohortSize ?? SMART_METER_HOUSEHOLD_COUNT,
                      wwCohortSize: wasserWasserRobustness?.cohortSize ?? null,
                    }).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          {mode === "historical" ? (
            <div className="mx-auto mt-8 flex min-w-0 w-full max-w-sheet flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Link href="/calculate" className={BTN_PRIMARY}>
                Neue Berechnung
              </Link>
            </div>
          ) : null}
        </div>
  );
}
