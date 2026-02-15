/**
 * Shared Constants for Speicher Module
 * 
 * These constants ensure consistency between Landing Page and Result Page.
 * All scenario names, electricity price scenarios, and key terminology
 * should be defined here to maintain semantic alignment.
 */

// =============================================================================
// STORAGE SCENARIOS
// =============================================================================

/**
 * Battery storage scenarios used throughout the Speicher module.
 * Order and naming must be consistent across all pages.
 */
export const STORAGE_SCENARIOS = [
  { id: "none", capacityKwh: 0, label: "Ohne Speicher" },
  { id: "5kwh", capacityKwh: 5, label: "Speicher 5 kWh" },
  { id: "7.5kwh", capacityKwh: 7.5, label: "Speicher 7,5 kWh" },
  { id: "10kwh", capacityKwh: 10, label: "Speicher 10 kWh" },
] as const;

export type StorageScenarioId = typeof STORAGE_SCENARIOS[number]["id"];

// =============================================================================
// ELECTRICITY PRICE SCENARIOS
// =============================================================================

/**
 * Electricity price growth scenarios.
 * Referenced on Landing Page (explanation) and Result Page (selector).
 */
export const PRICE_GROWTH_SCENARIOS = [
  {
    id: "0",
    label: "0 % pro Jahr",
    rate: 0,
    description: "konstanter Strompreis – Basis",
    shortLabel: "0%",
  },
  {
    id: "3",
    label: "+3 % pro Jahr",
    rate: 0.03,
    description: "moderater Anstieg",
    shortLabel: "+3%",
  },
  {
    id: "6",
    label: "+6 % pro Jahr",
    rate: 0.06,
    description: "stärkerer Anstieg",
    shortLabel: "+6%",
  },
] as const;

export type PriceScenarioId = typeof PRICE_GROWTH_SCENARIOS[number]["id"];

// =============================================================================
// KEY TERMINOLOGY (German)
// =============================================================================

/**
 * Key messages and terminology used across Landing and Result pages.
 * These ensure consistency in messaging and user experience.
 */
export const TERMINOLOGY = {
  // Strategic framing
  strategicInvestment: "Ein Stromspeicher ist keine Sparmaßnahme, sondern eine strategische Investition.",
  gridIndependence: "Ein Stromspeicher ist keine Wette auf einen bestimmten Strompreis. Er ist eine Entscheidung, wie abhängig Sie in Zukunft vom Netz bleiben möchten.",
  
  // Transparency statements
  basedOnNumbers: "Unsere Empfehlung basiert auf Zahlen – nicht auf Verkaufsinteressen.",
  noPredictions: "Niemand kann vorhersagen, wie hoch der Strompreis in 10 oder 15 Jahren sein wird.",
  
  // Lifecycle logic
  smallerBatteries: "Kleinere Speicher werden häufiger genutzt und erreichen ihre maximale Zyklenzahl früher.",
  largerBatteries: "Größere Speicher werden weniger stark belastet und behalten ihre Kapazität länger.",
  
  // "Ohne Speicher" explanation
  whyNoBatteryIsCheaper: {
    title: 'Warum ist „Ohne Speicher" trotzdem günstiger?',
    explanation: "Ohne Speicher vermeiden Sie eine Anfangsinvestition. Dafür zahlen Sie dauerhaft höhere Stromkosten und bleiben vollständig vom Strompreis abhängig.",
  },
  
  // Interpretation note
  interpretationNote: {
    title: "Hinweis zur Interpretation",
    main: 'Die Variante „Ohne Speicher" verursacht die geringsten Gesamtausgaben, bietet jedoch keine Investitionswirkung, keine Unabhängigkeit und keine Absicherung gegen steigende Strompreise.',
  },
} as const;

// =============================================================================
// RESULT METRICS
// =============================================================================

/**
 * Metrics shown for each scenario (Landing Page preview, Result Page details)
 */
export const SCENARIO_METRICS = [
  { key: "selfConsumption", label: "Eigenverbrauchsanteil", unit: "%" },
  { key: "gridImport", label: "Netzbezug", unit: "kWh/Jahr" },
  { key: "feedIn", label: "Einspeisung", unit: "kWh/Jahr" },
  { key: "annualSavings", label: "Jährliche Ersparnis", unit: "€" },
  { key: "lifetime", label: "Geschätzte Lebensdauer", unit: "Jahre" },
] as const;

// =============================================================================
// LIFECYCLE FACTORS
// =============================================================================

/**
 * Limiting factors for battery lifetime (used in lifecycle table)
 */
export const LIMITING_FACTORS = {
  cycles: { label: "Zyklen", color: "amber" },
  calendar: { label: "Kalender", color: "emerald" },
} as const;

export type LimitingFactor = keyof typeof LIMITING_FACTORS;

// =============================================================================
// COMPARISON MODES
// =============================================================================

/**
 * Comparison modes for economic analysis.
 * Must be consistent between Landing Page (explanation) and Result Page (selector).
 * 
 * - Fixed periods (10, 15 years): Same period for all scenarios, fair comparison
 * - Technical Lifetime (advanced): Each scenario uses its individual technical lifetime
 */
export const COMPARISON_MODES = [
  {
    id: "10",
    label: "Vergleichszeitraum: 10 Jahre",
    shortLabel: "10 Jahre",
    description: "Konservativ",
    isAdvanced: false,
    isRecommended: false,
  },
  {
    id: "15",
    label: "Vergleichszeitraum: 15 Jahre",
    shortLabel: "15 Jahre",
    description: "Standard – entspricht der kalendarischen Lebensdauer moderner LiFePO4-Speicher",
    isAdvanced: false,
    isRecommended: true,
  },
  {
    id: "technicalLifetime",
    label: "Technische Lebensdauer Speicher",
    shortLabel: "Techn. Lebensdauer",
    description: "Fortgeschritten – jedes Szenario verwendet seine individuelle technische Lebensdauer",
    isAdvanced: true,
    isRecommended: false,
  },
] as const;

export type ComparisonModeId = typeof COMPARISON_MODES[number]["id"];

// =============================================================================
// METHODOLOGY
// =============================================================================

/**
 * Methodology explanation points - used on Landing Page and Result Page.
 * The "8760 hours" concept must be explained clearly.
 */
export const METHODOLOGY = {
  // Simulation period
  simulationPeriod: {
    hours: 8760,
    explanation: "8.760 Stunden entsprechen einem vollen Jahr (365 Tage × 24 Stunden)",
  },
  
  // Calculation steps (used in TransparencySection)
  calculationSteps: [
    "Stündliche Simulation über ein volles Jahr (8.760 Stunden = 1 Jahr)",
    "Haushaltsverbrauch basierend auf BDEW-Standardlastprofil H0",
    "Stündlicher Abgleich: Überschuss (→ Speicher/Netz) oder Defizit (→ Speicher/Netzbezug)",
    "Speichersimulation: Laden, Entladen und Verluste – Stunde für Stunde",
    "Herstellerdaten: Zyklen, Wirkungsgrad und kalendarische Lebensdauer",
    "Strompreisentwicklung: Szenarien über bis zu 15 Jahre",
  ],
  
  // Technical notes
  noSmartMeter: "Keine Smart-Meter-Anbindung, keine Live-Daten erforderlich.",
  validatedModels: "Alle Berechnungen basieren auf validierten Modellen und öffentlich verfügbaren Daten.",
  
  // Lifecycle calculation formula
  lifecycleFormula: "min(kalendarische Lebensdauer, maximale Zyklen ÷ Zyklen pro Jahr)",
  
  // Technical limits
  technicalLimits: {
    maxCycles: 6000,
    calendarYears: 15,
    efficiency: "~94%",
  },
} as const;

// =============================================================================
// ADVANCED MODE WARNINGS
// =============================================================================

/**
 * Warnings for advanced/technical features.
 * Used when "Technical Lifetime" mode is active.
 */
export const ADVANCED_WARNINGS = {
  technicalLifetime: {
    title: "Technische Lebensdauer (Fortgeschritten)",
    description: "In diesem Modus wird jedes Speicher-Szenario über seine individuelle technische Lebensdauer berechnet.",
    formula: "Die Lebensdauer ergibt sich aus: min(kalendarische Lebensdauer, maximale Zyklen ÷ Zyklen pro Jahr)",
    disclaimer: "Dies ist eine theoretische Obergrenze, keine Garantie oder Vorhersage. Die tatsächliche Lebensdauer hängt von Betriebsbedingungen, Temperatur und Wartung ab.",
  },
} as const;

