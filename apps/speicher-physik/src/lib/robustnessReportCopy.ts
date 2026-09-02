/**
 * Homeowner-facing robustness report copy.
 * Presentation only — does not change physics, payloads, or aggregates.
 */

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

export function shouldShowWwRobustnessSection(
  wasserWasserRobustness: unknown
): boolean {
  return wasserWasserRobustness != null;
}

export function formatReportKwh(value: number): string {
  return `${Math.round(value)} kWh`;
}

export function formatReportPct(value: number): string {
  return `${Math.round(value)} %`;
}

export function formatReportRangeKwh(min: number, max: number): string {
  const lo = Math.round(min);
  const hi = Math.round(max);
  return lo === hi ? formatReportKwh(lo) : `${lo}–${hi} kWh`;
}

export function formatReportRangePct(min: number, max: number): string {
  const lo = Math.round(min);
  const hi = Math.round(max);
  return lo === hi ? formatReportPct(lo) : `${lo}–${hi} %`;
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
