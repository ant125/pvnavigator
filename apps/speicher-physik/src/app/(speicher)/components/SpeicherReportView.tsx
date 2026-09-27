"use client";

import Link from "next/link";
import type { ReactNode, RefObject } from "react";

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
import { RESULT_SECTION_IDS } from "../calculate/resultNav";
import { EV_REPORT_COPY, formatEvKwh } from "@/lib/evReportPresentation";
import {
  formatQuantityDe,
  formatQuantityWithUnit,
} from "@/lib/formatQuantityDe";
import type { FrozenSpeicherPresentation } from "@/lib/persistCompletedCalculation";
import { SpeicherBenefitComparison } from "./SpeicherBenefitComparison";

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
  "mx-auto min-w-0 w-full max-w-sheet rounded-sm border border-line bg-surface p-5 sm:p-8 lg:p-10";

const REPORT_SHEET_WORKSPACE =
  "sg-workspace-report min-w-0 w-full bg-surface p-5 sm:p-6";

/**
 * Major section boundary inside the sheet: one rule with symmetric space above
 * and below, so every section transition carries the same weight. Section
 * headings therefore need no rule of their own.
 */
const REPORT_SECTION = "mt-8 min-w-0 max-w-full border-t border-line pt-8 lg:mt-10 lg:pt-10";

/** Report-section heading — a document chapter, not a micro label. */
const REPORT_SECTION_HEADING =
  "font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-accent-text";

const WORKSPACE_CHAPTER_RULE =
  "mt-[1.875rem] min-w-0 max-w-full border-t border-line pt-[1.875rem]";

/**
 * Same rhythm as WORKSPACE_CHAPTER_RULE, for the Anlage panel that precedes the
 * first chapter. The chapter after it renders as `first` and carries no top
 * spacing, so this gap never doubles; collapsing the panel removes it too.
 */
const WORKSPACE_CHAPTER_GAP = "mb-[1.875rem]";

const WORKSPACE_CHAPTER_EYEBROW =
  "font-mono text-[11px] font-bold uppercase leading-none tracking-[0.2em] text-accent-text";

const WORKSPACE_CHAPTER_TITLE =
  "font-sans text-[1.5rem] font-bold leading-[1.15] tracking-[-0.01em] text-ink";

function WorkspaceChapter({
  id,
  eyebrow,
  title,
  children,
  first = false,
}: {
  id: string;
  eyebrow: string;
  title?: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <section
      id={id}
      className={`sg-result-anchor min-w-0 max-w-full ${
        first ? "" : WORKSPACE_CHAPTER_RULE
      }`}
    >
      <p className={WORKSPACE_CHAPTER_EYEBROW}>{eyebrow}</p>
      {title ? (
        <h2 className={`mt-2 ${WORKSPACE_CHAPTER_TITLE}`}>{title}</h2>
      ) : null}
      <div className={title ? "mt-[1.125rem]" : "mt-4"}>{children}</div>
    </section>
  );
}

/** Micro label above a value or a form group. */
const REPORT_SECTION_TITLE =
  "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-secondary";

const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-sm bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover";



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
  "sg-metric-list divide-y divide-line-soft border-y border-line-soft text-sm";

/** Metric row: label left, value aligned to the right edge of its track. */
const REPORT_METRIC_ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 py-3";

const REPORT_METRIC_LABEL = "min-w-0 leading-snug text-ink-secondary";

const REPORT_METRIC_VALUE =
  "sg-metric-value shrink-0 whitespace-nowrap text-right font-mono text-sm tabular-nums font-medium text-ink";

const REPORT_METRIC_VALUE_ACCENT =
  "sg-metric-value shrink-0 whitespace-nowrap text-right font-mono text-sm tabular-nums font-semibold text-accent-text";

/**
 * Stammdaten datasheet: short label above its value, three columns on desktop,
 * so a small dataset stays horizontally compact instead of vertically long.
 */
const REPORT_DATA_GRID = "grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3";

const REPORT_DATA_ITEM = "border-t border-line-soft pt-3";

const REPORT_DATA_LABEL = "text-xs leading-snug text-ink-muted";

const REPORT_DATA_VALUE = "mt-1 font-mono text-sm font-medium tabular-nums text-ink";

/**
 * Tinted technical band for a nested energy balance inside a section: the total
 * on top, its components below, all within one boundary so the components read
 * as parts of that total rather than as separate metrics.
 */
const REPORT_BAND =
  "mt-8 rounded-sm border border-line-soft bg-surface-muted p-5 lg:p-6";

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
  variant?: "page" | "workspace";
  /**
   * Live /calculate only. When set, Grundlage is mounted under this scene
   * instead of as a trailing report chapter. Saved /result/[id] omits it.
   */
  anlageScene?: ReactNode;
  anlageOpen?: boolean;
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
  variant = "page",
  anlageScene = null,
  anlageOpen = false,
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
    batteryGeladenAvgKwh,
    batteryAnVerbrauchAvgKwh,
    batterieverlusteModellGesamtKwh,
    avgSelfDischargeLossDisplayKwh,
    avgAuxiliaryConsumptionDisplayKwh,
    eigenverbrauchOhneSpeicher,
    eigenverbrauchMitSpeicher,
    autarkieOhneUnroundedPct,
    autarkieMitUnroundedPct,
    autarkieMitPct,
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
    typeof value === "number" && Number.isFinite(value)
      ? formatQuantityWithUnit(value, "kWh", 0)
      : PLACEHOLDER;

  const formatKwhPerYear = (value: number | null | undefined, digits = 0) =>
    typeof value === "number" && Number.isFinite(value)
      ? formatQuantityWithUnit(value, "kWh/Jahr", digits)
      : PLACEHOLDER;

  const formatRoundedKwhPerYear = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? formatQuantityWithUnit(Math.round(value), "kWh/Jahr")
      : PLACEHOLDER;

  const formatPct = (value: number | null) =>
    value !== null ? formatQuantityWithUnit(value, "%") : PLACEHOLDER;


  const isWorkspace = variant === "workspace";

  const masthead = (
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
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-accent-text">
                  {mode === "historical"
                    ? "Gespeicherter Bericht"
                    : "Analyse abgeschlossen"}
                </span>
              </div>
              {variant === "page" ? (
                <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
                  Ihre Speicher-Analyse
                </h1>
              ) : null}
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
  );

  const recommendationBody = (
    <>
              {recommendedTechnicalSize > 0 ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-sm border border-line bg-accent-soft/70 p-5">
                      <p className={`${REPORT_SECTION_TITLE} sg-kpi-name`}>
                        Technische Speichergrenze
                      </p>
                      <p className="sg-kpi-value mt-2 whitespace-nowrap font-mono text-4xl font-semibold tabular-nums tracking-tight text-ink">
                        {formatQuantityDe(recommendedTechnicalSize)}
                        {"\u00A0"}
                        <span className="text-lg font-medium">kWh</span>
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                        Nutzbare Kapazität heute. Alle technischen Kennzahlen
                        beziehen sich auf diesen Wert.
                      </p>
                    </div>
                    <div className="rounded-sm border border-line bg-surface-muted p-5">
                      <p className={`${REPORT_SECTION_TITLE} sg-kpi-name`}>
                        Planerische Anfangskapazität
                      </p>
                      <p className="sg-kpi-value mt-2 whitespace-nowrap font-mono text-4xl font-semibold tabular-nums tracking-tight text-ink">
                        {formatQuantityDe(recommendedPlanningSize)}
                        {"\u00A0"}
                        <span className="text-lg font-medium">kWh</span>
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                        Für die Kaufplanung bei angenommenen 75&nbsp;% Restkapazität
                      </p>
                    </div>
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
                      dass nach einem Planungszeitraum von etwa 10 Jahren noch
                      75&nbsp;% der anfänglichen nutzbaren Kapazität verfügbar
                      sind.
                    </p>
                    <p className="rounded-sm border border-line-soft bg-surface-muted px-4 py-3 font-mono font-medium tabular-nums text-ink">
                      Planerische Anfangskapazität = ⌈{" "}
                      {formatQuantityWithUnit(recommendedTechnicalSize, "kWh")} / 0,75 ⌉ ={" "}
                      {formatQuantityWithUnit(recommendedPlanningSize, "kWh")}
                    </p>
                    <p className="text-xs italic leading-relaxed text-ink-muted">
                      Die 75-%-Annahme ist keine Prognose für einen bestimmten
                      Batteriespeicher und keine Herstellergarantie. Sie
                      beeinflusst ausschließlich die planerische
                      Kaufempfehlung. Die technische Simulation und sämtliche
                      technischen Kennzahlen werden weiterhin mit der
                      technischen Speichergrenze von {recommendedTechnicalSize}{" "}
                      kWh berechnet.
                    </p>
                    {planningExceedsSimulatedRange && (
                      <p className="rounded-sm border border-warning/40 bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning">
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
    </>
  );

  const comparisonInner = (
    <SpeicherBenefitComparison
      eigenverbrauchOhneKwh={eigenverbrauchOhneSpeicher}
      eigenverbrauchMitKwh={
        speicherGrenz == null ? null : eigenverbrauchMitSpeicher
      }
      autarkieOhneUnroundedPct={autarkieOhneUnroundedPct}
      autarkieMitUnroundedPct={
        speicherGrenz == null ? null : autarkieMitUnroundedPct
      }
    />
  );

  const overviewClosing = (
    <div className="mt-6 max-w-reading space-y-2">
      {recommendedTechnicalSize > 0 ? (
        <p className="text-sm leading-relaxed text-ink-secondary">
          Eigenverbrauch und Autarkie beziehen sich auf die technische
          Speichergrenze
          {hasActiveBackupReserve ? (
            <>
              {" "}
              und berücksichtigen eine Notstromreserve von{" "}
              {formatQuantityWithUnit(resolvedBackupReserveKwh, "kWh")}
            </>
          ) : null}
          .
        </p>
      ) : null}
      <p className="text-xs leading-relaxed text-ink-muted">
        Berechnungsgrundlage: BDEW H25
      </p>
    </div>
  );

  const foundationInner = speicherGrenz ? (
    <>
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
                            {formatQuantityWithUnit(resolvedBackupReserveKwh, "kWh")}
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
                          {typeof input.annualConsumptionKwh === "number"
                            ? formatQuantityWithUnit(
                                input.annualConsumptionKwh,
                                "kWh/Jahr"
                              )
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      {input.heatPumpEnabled === true && (
                        <>
                          <div className={REPORT_DATA_ITEM}>
                            <dt className={REPORT_DATA_LABEL}>
                              {EV_REPORT_COPY.heatPumpLoad}:
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {typeof input.heatPumpConsumptionKwh === "number"
                                ? formatQuantityWithUnit(
                                    input.heatPumpConsumptionKwh,
                                    "kWh/Jahr"
                                  )
                                : PLACEHOLDER}
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
                              : formatQuantityWithUnit(
                                  (input.annualConsumptionKwh ?? 0) +
                                    (input.heatPumpEnabled === true
                                      ? input.heatPumpConsumptionKwh ?? 0
                                      : 0),
                                  "kWh/Jahr"
                                )}
                          </div>
                          {input.heatPumpEnabled === true && ev == null && (
                            <div className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-1`}>
                              davon Wärmepumpe:{" "}
                              {typeof input.heatPumpConsumptionKwh === "number"
                                ? formatQuantityWithUnit(
                                    input.heatPumpConsumptionKwh,
                                    "kWh"
                                  )
                                : PLACEHOLDER}
                            </div>
                          )}
                        </dd>
                      </div>
                    </dl>

                    {ev != null && <EvResultSection ev={ev} />}
    </>
  ) : null;

  const kennzahlenHelper = (
                      <p className="mt-2 max-w-reading text-xs leading-relaxed text-ink-muted">
                        Alle technischen Kennzahlen beziehen sich auf die
                        technische Speichergrenze von{" "}
                        <strong className="font-semibold text-ink-secondary">
                          {recommendedTechnicalSize} kWh
                        </strong>{" "}
                        und nicht auf die planerische Kaufempfehlung.
                      </p>
  );

  const balanceRest = (
    <>
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
                            ? formatKwhPerYear(pvYieldKwhAnnual, 0)
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Spezifischer Ertrag
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {specificYieldKwhPerKwp !== null
                            ? formatQuantityWithUnit(
                                specificYieldKwhPerKwp,
                                "kWh/kWp",
                                1
                              )
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
                            ? formatRoundedKwhPerYear(batteryGeladenAvgKwh)
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
                            ? formatRoundedKwhPerYear(batteryAnVerbrauchAvgKwh)
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
                            ? formatRoundedKwhPerYear(avgAuxiliaryConsumptionDisplayKwh)
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
                            ? formatKwhPerYear(netzbezugMitSpeicherKwhYear, 0)
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
                            ? formatKwhPerYear(einspeisungRechnerischKwhYear, 0)
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Autarkiegrad mit Speicher
                        </dt>
                        <dd className={REPORT_METRIC_VALUE_ACCENT}>
                          {formatPct(autarkieMitPct)}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Eigenverbrauchsquote
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {formatPct(eigenverbrauchsquoteMitSpeicherPct)}
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
                          <div className="sg-loss-total shrink-0 text-right font-mono text-lg font-semibold tabular-nums text-ink">
                            {formatRoundedKwhPerYear(batterieverlusteModellGesamtKwh)}
                          </div>
                        </div>

                        <dl className={REPORT_BAND_GRID}>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              PV → Speicher
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {formatRoundedKwhPerYear(
                                speicherGrenz.averageChargeLossPvToBatteryKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Zellverluste beim Laden
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {formatRoundedKwhPerYear(
                                speicherGrenz.averageChargeLossChemicalKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Zellverluste beim Entladen
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {formatRoundedKwhPerYear(
                                speicherGrenz.averageDischargeLossChemicalKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Speicher → AC-Bus
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {formatRoundedKwhPerYear(
                                speicherGrenz
                                  .averageDischargeLossBatteryToAcKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}
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
                                ? formatRoundedKwhPerYear(
                                    avgSelfDischargeLossDisplayKwh
                                  )
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
    </>
  );

  const chartInner = (
    <>
                  <SpeicherChart
                    data={chart.data}
                    recommendedTechnicalSize={recommendedTechnicalSize}
                  />

                  <div className="mt-4 max-w-reading text-sm leading-relaxed text-ink-secondary">
                    Der zusätzliche Eigenverbrauch nimmt mit wachsender
                    Speichergröße deutlich ab. Ab einem bestimmten Punkt bringt
                    mehr Speicher nur noch geringen Mehrwert.
                  </div>
    </>
  );

  const robustnessBlock = robustness ? (
              <WpuqRobustnessSection
                robustness={robustness}
                wasserWasserRobustness={wasserWasserRobustness}
                bdew={{
                  technicalSpeichergrenzeKwh: recommendedTechnicalSize,
                  eigenverbrauchsquotePct: eigenverbrauchsquoteMitSpeicherPct,
                  autarkiePct: autarkieMitPct,
                }}
              />
            ) : null;

  const assessmentBody = (
    <>
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
                            {formatQuantityWithUnit(resolvedBackupReserveKwh, "kWh")}.
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
                          {formatQuantityWithUnit(recommendedPlanningSize, "kWh")}
                        </dd>
                      </div>
                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>
                          Technische Speichergrenze
                        </dt>
                        <dd className={REPORT_DATA_VALUE}>
                          {formatQuantityWithUnit(recommendedTechnicalSize, "kWh")}
                        </dd>
                      </div>
                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>Plateau ab</dt>
                        <dd className={REPORT_DATA_VALUE}>
                          {formatQuantityWithUnit(recommendedTechnicalSize, "kWh")}
                        </dd>
                      </div>
                      {hasActiveBackupReserve && (
                        <div className={REPORT_DATA_ITEM}>
                          <dt className={REPORT_DATA_LABEL}>Notstromreserve</dt>
                          <dd className={REPORT_DATA_VALUE}>
                            {formatQuantityWithUnit(resolvedBackupReserveKwh, "kWh")}
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
                      15-Minuten-Schritten ({formatQuantityDe(35040)} Zeitschritte pro Jahr). Die
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
    </>
  );

  const quellen = (
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
  );

  const workspaceQuellen = (
    <WorkspaceChapter
      id={RESULT_SECTION_IDS.sources}
      eyebrow="Quellen"
      title="Quellen & wissenschaftliche Grundlagen"
    >
      <ReportQuellenSection
        hideHeading
        framed={false}
        heatPump={heatPumpCitation}
        ev={
          ev
            ? {
                methodologySourceIds: ev.methodologySourceIds,
              }
            : null
        }
      />
    </WorkspaceChapter>
  );

  const disclaimer = (
    <>
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
    </>
  );

  const showAnlage = isWorkspace && anlageScene != null;

  const anlagePanel = showAnlage ? (
    <div
      id="anlage-eingaben"
      className={`${WORKSPACE_CHAPTER_GAP} ${
        anlageOpen ? "sg-anlage" : "sg-anlage sg-anlage-collapsed"
      }`}
    >
      <p className="mb-3 text-xs leading-relaxed text-ink-muted">
        Schematische Darstellung der gewählten Komponenten – nicht die Geometrie
        Ihres Gebäudes.
      </p>
      {anlageScene}
      {foundationInner ? (
        <section className="sg-anlage-basis mt-5 border-t border-line pt-6">
          <p className={WORKSPACE_CHAPTER_EYEBROW}>Grundlage</p>
          <h2 className={`mt-1.5 ${WORKSPACE_CHAPTER_TITLE}`}>
            Grundlage der Berechnung
          </h2>
          <div className="mt-6">{foundationInner}</div>
        </section>
      ) : null}
    </div>
  ) : null;

  const chapters = isWorkspace ? (
    <>
      {anlagePanel}
      <WorkspaceChapter
        id={RESULT_SECTION_IDS.overview}
        eyebrow="Überblick"
        title="Berechnung nach BDEW H25"
        first
      >
        {recommendationBody}
        <div className="mt-8">{comparisonInner}</div>
        {overviewClosing}
        <div className={REPORT_SECTION}>
          <h2 className={WORKSPACE_CHAPTER_TITLE}>Unsere Einschätzung</h2>
          <div className="mt-6">{assessmentBody}</div>
        </div>
      </WorkspaceChapter>
      {speicherGrenz ? (
        <WorkspaceChapter
          id={RESULT_SECTION_IDS.storageSize}
          eyebrow="Speichergröße"
          title="Eigenverbrauch vs Speichergröße"
        >
          {chartInner}
        </WorkspaceChapter>
      ) : (
        <section
          id={RESULT_SECTION_IDS.storageSize}
          className="sg-result-anchor"
        />
      )}
      <WorkspaceChapter id={RESULT_SECTION_IDS.profiles} eyebrow="Profile">
        {robustnessBlock}
      </WorkspaceChapter>
      {speicherGrenz ? (
        <WorkspaceChapter
          id={RESULT_SECTION_IDS.balance}
          eyebrow="Bilanz"
          title="Technische Kennzahlen"
        >
          <div className="mb-6">{kennzahlenHelper}</div>
          {balanceRest}
        </WorkspaceChapter>
      ) : (
        <section
          id={RESULT_SECTION_IDS.balance}
          className="sg-result-anchor"
        />
      )}
      {showAnlage ? null : speicherGrenz ? (
        <WorkspaceChapter
          id={RESULT_SECTION_IDS.foundation}
          eyebrow="Grundlage"
          title="Grundlage der Berechnung"
        >
          {foundationInner}
        </WorkspaceChapter>
      ) : (
        <section
          id={RESULT_SECTION_IDS.foundation}
          className="sg-result-anchor"
        />
      )}
      {workspaceQuellen}
      {disclaimer}
    </>
  ) : (
    <>
      {masthead}
      <section className={REPORT_SECTION}>
        <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
          02 / Ergebnis · Berechnung nach BDEW H25
        </h2>
        {recommendationBody}
      </section>
      <section className={REPORT_SECTION}>{comparisonInner}</section>
      {overviewClosing}
      {speicherGrenz ? (
        <>
          <section className={REPORT_SECTION}>
            <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
              03 / Ihre Eingabedaten
            </h2>
            {foundationInner}
          </section>
          <section className={REPORT_SECTION}>
            <div className="mb-6">
              <h2 className={REPORT_SECTION_HEADING}>
                04 / Technische Kennzahlen
              </h2>
              {kennzahlenHelper}
            </div>
            {balanceRest}
          </section>
          <section className={REPORT_SECTION}>
            <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
              05 / Eigenverbrauch vs Speichergröße
            </h2>
            {chartInner}
          </section>
        </>
      ) : null}
      {robustnessBlock}
      <section className={REPORT_SECTION}>
        <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
          06 / Unsere Einschätzung
        </h2>
        {assessmentBody}
      </section>
      {quellen}
      {disclaimer}
    </>
  );

  return (
        <div className={variant === "workspace" ? "min-w-0 w-full" : "mx-auto min-w-0 w-full max-w-frame px-4 sm:px-6 lg:px-8"}>
          <div className={variant === "workspace" ? REPORT_SHEET_WORKSPACE : REPORT_SHEET}>
            {chapters}
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
