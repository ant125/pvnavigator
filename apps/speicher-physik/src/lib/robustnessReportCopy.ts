/**
 * Homeowner-facing robustness report copy.
 * Presentation only — does not change physics, payloads, or aggregates.
 */

import {
  formatQuantityDe,
  formatQuantityWithUnit,
} from "./formatQuantityDe";

export const HOUSEHOLD_ROBUSTNESS_QUESTION =
  "Was ändert sich, wenn Ihr Haushalt Strom anders verbraucht als das BDEW-Standardprofil?";

export const WW_ROBUSTNESS_QUESTION =
  "Was ändert sich, wenn Ihre Wasser/Wasser-Wärmepumpe im Alltag anders arbeitet als das verwendete Referenzprofil?";

/**
 * Short BDEW H25 hint. Wording follows the registered methodology
 * (standard household load profile, temporal distribution, scaled to
 * annual consumption). No household-count claim.
 */
export const BDEW_STANDARDPROFIL_HINT =
  "Das BDEW H25 ist ein standardisiertes Haushaltslastprofil für Deutschland. Es beschreibt, wie sich der Jahresstromverbrauch typischer Haushalte zeitlich über Tage und das Jahr verteilt.";

export const ROBUSTNESS_DOES_NOT_REPLACE_RECOMMENDATION =
  "Die Speicherempfehlung oben bleibt die Hauptrechnung. Dieser Vergleich zeigt nur, wie empfindlich das Ergebnis reagiert, wenn sich der zeitliche Verlauf ändert.";

export const WW_HEAT_PUMP_DIFFER_EXPLANATION =
  "Reale Wärmepumpenanlagen können ihren Strom zu unterschiedlichen Zeiten benötigen. Mögliche Einflüsse sind der Wärmebedarf des Gebäudes, die gewünschte Raumtemperatur, die Regelung und Heizkurve, eine Zusatzheizung sowie individuelles Nutzungsverhalten. Die konkreten Ursachen sind im Datensatz nicht für jedes Gebäude vollständig dokumentiert.";

export const HOUSEHOLD_CONCLUSION_STABLE =
  "Die zeitliche Verteilung des Haushaltsverbrauchs verändert einzelne Kennzahlen, die technische Speichergröße bleibt jedoch weitgehend stabil.";

export const HOUSEHOLD_CONCLUSION_UNCHANGED =
  "Die zeitliche Verteilung des Haushaltsverbrauchs verändert einzelne Kennzahlen, die technische Speichergröße bleibt jedoch unverändert.";

export const HOUSEHOLD_CONCLUSION_SENSITIVE =
  "Die Speicherempfehlung reagiert in diesem Fall stärker auf unterschiedliche Verbrauchsgewohnheiten.";

export const WW_CONCLUSION_STABLE =
  "Auch bei unterschiedlichen real gemessenen Wasser/Wasser-Lastprofilen bleibt die technische Speicherempfehlung weitgehend stabil.";

export const WW_CONCLUSION_UNCHANGED =
  "Auch bei unterschiedlichen real gemessenen Wasser/Wasser-Lastprofilen bleibt die technische Speicherempfehlung unverändert.";

export const WW_CONCLUSION_SENSITIVE =
  "Der Vergleich zeigt, in welchem Bereich sich die technische Speichergrenze bei realen Wasser/Wasser-Wärmepumpen bewegt.";

export type SizeStability = "unchanged" | "majority" | "sensitive";

export type RobustnessSizeCounts = {
  cohortSize: number;
  sizeUnchangedCount: number;
};

/** Majority: strictly more than half of profiles keep the production size. */
export function recommendationSizeStability(
  counts: RobustnessSizeCounts
): SizeStability {
  const { cohortSize, sizeUnchangedCount } = counts;
  if (cohortSize <= 0 || sizeUnchangedCount < 0) return "sensitive";
  if (sizeUnchangedCount === cohortSize) return "unchanged";
  if (sizeUnchangedCount * 2 > cohortSize) return "majority";
  return "sensitive";
}

export function householdRobustnessExplanation(cohortSize: number): string[] {
  return [
    "Die Hauptrechnung verwendet das BDEW-H25-Standardprofil für den Haushaltsverbrauch.",
    `PVNavigator wiederholt dieselbe Berechnung anschließend mit ${cohortSize} gemessenen realen Haushaltsprofilen.`,
    "Geändert wird nur der zeitliche Verlauf des Haushaltsverbrauchs. PV-Anlage, Jahresstromverbrauch des Haushalts, Wärmepumpe, Wetterdaten, Batteriemodell und alle übrigen Annahmen bleiben unverändert.",
    ROBUSTNESS_DOES_NOT_REPLACE_RECOMMENDATION,
  ];
}

export function wwRobustnessExplanation(cohortSize: number): string[] {
  return [
    "Die Hauptrechnung verwendet ein gemessenes Wasser/Wasser-Referenzprofil.",
    `PVNavigator wiederholt dieselbe Berechnung anschließend mit ${cohortSize} weiteren gemessenen Wasser/Wasser-Wärmepumpenprofilen.`,
    "Geändert wird nur der zeitliche Strombedarf der Wärmepumpe. Haushaltsprofil, Jahresverbrauch von Haushalt und Wärmepumpe, PV-Anlage, Wetterjahre, Batteriemodell und alle übrigen Angaben bleiben unverändert.",
    ROBUSTNESS_DOES_NOT_REPLACE_RECOMMENDATION,
  ];
}

export function householdRobustnessConclusion(
  counts: RobustnessSizeCounts
): string {
  const stability = recommendationSizeStability(counts);
  if (stability === "unchanged") return HOUSEHOLD_CONCLUSION_UNCHANGED;
  if (stability === "majority") return HOUSEHOLD_CONCLUSION_STABLE;
  return HOUSEHOLD_CONCLUSION_SENSITIVE;
}

export function wwRobustnessConclusion(counts: RobustnessSizeCounts): string {
  const stability = recommendationSizeStability(counts);
  if (stability === "unchanged") return WW_CONCLUSION_UNCHANGED;
  if (stability === "majority") return WW_CONCLUSION_STABLE;
  return WW_CONCLUSION_SENSITIVE;
}

/**
 * Short label for an existing stability class. No new threshold.
 * Wording follows the conclusions already used in the report.
 */
export function robustnessStabilityLabel(stability: SizeStability): string {
  if (stability === "unchanged") return "Unverändert";
  if (stability === "majority") return "Weitgehend stabil";
  return "Stärker lastabhängig";
}

export const ROBUSTNESS_OVERVIEW_TITLE =
  "Robustheit der technischen Speichergrenze";

export const ROBUSTNESS_KPI_FOLLOW =
  "Eigenverbrauch und Autarkie reagieren stärker auf das zeitliche Verbrauchsprofil als die empfohlene Speichergröße.";

function roundedSizeSpan(min: number, max: number): { lo: number; hi: number } {
  return { lo: Math.round(min), hi: Math.round(max) };
}

/** Sentence for the overview. The range stays inside the sentence, not as its own figure. */
export function overviewSizeSpanSentence(
  min: number,
  max: number,
  cohortSize: number,
  profilePhrase: string
): string {
  const { lo, hi } = roundedSizeSpan(min, max);
  if (lo === hi) {
    return `Bei ${cohortSize} ${profilePhrase} liegt sie bei ${formatQuantityDe(lo)} kWh.`;
  }
  return `Bei ${cohortSize} ${profilePhrase} liegt sie zwischen ${formatQuantityDe(lo)} und ${formatQuantityDe(hi)} kWh.`;
}

export function householdOverviewSentence(input: {
  cohortSize: number;
  technicalSizeMinKwh: number;
  technicalSizeMaxKwh: number;
}): string {
  return overviewSizeSpanSentence(
    input.technicalSizeMinKwh,
    input.technicalSizeMaxKwh,
    input.cohortSize,
    "realen Haushaltsprofilen"
  );
}

export function wwOverviewSentence(input: {
  cohortSize: number;
  technicalSizeMinKwh: number;
  technicalSizeMaxKwh: number;
}): string {
  return overviewSizeSpanSentence(
    input.technicalSizeMinKwh,
    input.technicalSizeMaxKwh,
    input.cohortSize,
    "realen Wasser/Wasser-Profilen"
  );
}

/** Lead above the comparison table. Uses the existing min/max, not a new rating. */
export function technicalSizeRangeLead(
  min: number,
  max: number,
  group: "Haushaltsprofile" | "Wasser/Wasser-Profile"
): string {
  const { lo, hi } = roundedSizeSpan(min, max);
  if (lo === hi) {
    return `Die technische Speichergrenze bleibt über alle getesteten ${group} bei ${formatQuantityDe(lo)} kWh.`;
  }
  return `Die technische Speichergrenze bleibt über die getesteten ${group} zwischen ${formatQuantityDe(lo)} und ${formatQuantityDe(hi)} kWh.`;
}

/**
 * The follow-up is the existing stable reading: size holds, other KPIs move.
 * It is omitted when the existing class already says the size itself moves.
 */
export function robustnessKpiFollow(counts: RobustnessSizeCounts): string | null {
  const stability = recommendationSizeStability(counts);
  if (stability === "sensitive") return null;
  return ROBUSTNESS_KPI_FOLLOW;
}

/** Secondary note. Restates the existing class and the count it is based on. */
export function robustnessStabilityNote(
  counts: RobustnessSizeCounts,
  profileWord: "Profile" | "Wärmepumpenprofile"
): string {
  const stability = recommendationSizeStability(counts);
  const label = robustnessStabilityLabel(stability);
  const { cohortSize, sizeUnchangedCount } = counts;
  const kept = `${sizeUnchangedCount} von ${cohortSize} ${profileWord} behalten die technische Speichergrenze der Hauptrechnung.`;
  if (stability === "unchanged") {
    return `Einordnung: ${label}. Alle ${cohortSize} ${profileWord} behalten die technische Speichergrenze der Hauptrechnung.`;
  }
  if (stability === "majority") {
    return `Einordnung: ${label}. ${kept} Weitgehend stabil heißt: mehr als die Hälfte bleibt bei dieser Größe.`;
  }
  return `Einordnung: ${label}. ${kept} Stärker lastabhängig heißt: höchstens die Hälfte bleibt bei dieser Größe.`;
}

export function shouldShowWwRobustnessSection(
  wasserWasserRobustness: unknown
): boolean {
  return wasserWasserRobustness != null;
}

export function formatReportKwh(value: number): string {
  return formatQuantityWithUnit(Math.round(value), "kWh");
}

export function formatReportPct(value: number): string {
  return formatQuantityWithUnit(Math.round(value), "%");
}

export function formatReportRangeKwh(min: number, max: number): string {
  const lo = Math.round(min);
  const hi = Math.round(max);
  return lo === hi
    ? formatReportKwh(lo)
    : `${formatQuantityDe(lo)}–${formatQuantityDe(hi)}\u00A0kWh`;
}

export function formatReportRangePct(min: number, max: number): string {
  const lo = Math.round(min);
  const hi = Math.round(max);
  return lo === hi
    ? formatReportPct(lo)
    : `${formatQuantityDe(lo)}–${formatQuantityDe(hi)}\u00A0%`;
}

export function formatOptionalReportKwh(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatReportKwh(value)
    : "—";
}

export function formatOptionalReportPct(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatReportPct(value)
    : "—";
}

export function anonymizedProfileLabel(index: number): string {
  return `Profil ${index + 1}`;
}

const CUSTOMER_FORBIDDEN = [
  /\bSFH\d+/i,
  /ww-wpuq-2019/i,
  /cluster/i,
  /moderater?\s+winter/i,
  /starker?\s+winter/i,
  /\bP25\b/,
  /\bP75\b/,
  /\bMedian\b/,
  /Robustheitsprüfung/i,
];

export function customerFacingTextHasInternalIds(text: string): boolean {
  return CUSTOMER_FORBIDDEN.some((pattern) => pattern.test(text));
}

export type HouseholdDefaultViewInput = {
  cohortSize: number;
  sizeUnchangedCount: number;
  technicalSizeKwh: number;
  technicalSizeMinKwh: number;
  technicalSizeMaxKwh: number;
  eigenverbrauchsquotePct: number | null;
  eigenverbrauchsquoteMinPct: number;
  eigenverbrauchsquoteMaxPct: number;
  autarkiePct: number | null;
  autarkieMinPct: number;
  autarkieMaxPct: number;
};

export function householdDefaultViewText(
  input: HouseholdDefaultViewInput
): string {
  return [
    HOUSEHOLD_ROBUSTNESS_QUESTION,
    ...householdRobustnessExplanation(input.cohortSize),
    "BDEW H25",
    formatOptionalReportKwh(input.technicalSizeKwh),
    formatOptionalReportPct(input.eigenverbrauchsquotePct),
    formatOptionalReportPct(input.autarkiePct),
    `${input.cohortSize} reale Haushaltsprofile`,
    formatReportRangeKwh(input.technicalSizeMinKwh, input.technicalSizeMaxKwh),
    formatReportRangePct(
      input.eigenverbrauchsquoteMinPct,
      input.eigenverbrauchsquoteMaxPct
    ),
    formatReportRangePct(input.autarkieMinPct, input.autarkieMaxPct),
    householdRobustnessConclusion(input),
  ].join("\n");
}

export type WwDefaultViewInput = {
  cohortSize: number;
  sizeUnchangedCount: number;
  technicalSizeKwh: number;
  technicalSizeMinKwh: number;
  technicalSizeMaxKwh: number;
  eigenverbrauchsquotePct: number | null;
  eigenverbrauchsquoteMinPct: number;
  eigenverbrauchsquoteMaxPct: number;
  autarkiePct: number | null;
  autarkieMinPct: number;
  autarkieMaxPct: number;
};

export function wwDefaultViewText(input: WwDefaultViewInput): string {
  return [
    WW_ROBUSTNESS_QUESTION,
    ...wwRobustnessExplanation(input.cohortSize),
    WW_HEAT_PUMP_DIFFER_EXPLANATION,
    "Wasser/Wasser-Referenzprofil",
    formatOptionalReportKwh(input.technicalSizeKwh),
    formatOptionalReportPct(input.eigenverbrauchsquotePct),
    formatOptionalReportPct(input.autarkiePct),
    `${input.cohortSize} reale Wasser/Wasser-Profile`,
    formatReportRangeKwh(input.technicalSizeMinKwh, input.technicalSizeMaxKwh),
    formatReportRangePct(
      input.eigenverbrauchsquoteMinPct,
      input.eigenverbrauchsquoteMaxPct
    ),
    formatReportRangePct(input.autarkieMinPct, input.autarkieMaxPct),
    wwRobustnessConclusion(input),
  ].join("\n");
}
