/**
 * Heat-pump electrical profile types.
 *
 * Selection is (technology, DHW service), optionally overridden by profileId.
 * `year` is the simulation calendar year: February 29 is omitted on leap
 * years so the series stays on the non-leap 35 040-step grid. The measured
 * shape is not weekday-remapped.
 */

/** Quarter-hour steps on the production non-leap grid (365 × 96). */
export const HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR = 35040;

/** Duration of one production step in hours. */
export const HEAT_PUMP_TIME_STEP_HOURS = 0.25;

/** Envelope schema written by the research generators. */
export const HEAT_PUMP_ENVELOPE_SCHEMA_VERSION = 1;

/** Production technology class of a measured series. */
export type HeatPumpTechnology = "luftwasser" | "wasserwasser";

/**
 * Caller-facing technology input. `"unknown"` resolves to Luft/Wasser
 * (dominant German sales mix) and is recorded in `meta.fallback`.
 */
export type HeatPumpTechnologyInput = HeatPumpTechnology | "unknown";

/**
 * Whether the heat pump itself supplies domestic hot water.
 * This is not household DHW (that stays in the BDEW household series).
 */
export type HeatPumpDhwService = "space_heat_only" | "space_heat_and_dhw";

export type HeatPumpProfileQuality =
  | "lab-prototype"
  | "field-cohort-representative"
  | "manufacturer-reference";

/**
 * Named fallback used when the requested selection is not an exact
 * catalogue match. `false` means the resolved series matches the request.
 * Synthetic monthly fallback is not implemented in this package.
 */
export type HeatPumpFallback = false | "unknown-uses-luftwasser";

export type HeatPumpDefaultFor = {
  technology: HeatPumpTechnology;
  dhwService: HeatPumpDhwService;
};

/**
 * Catalogue record — the single source of truth for profile selection.
 * Provenance details beyond these fields live on the immutable envelope.
 */
export type HeatPumpCatalogueEntry = {
  profileId: string;
  technology: HeatPumpTechnology;
  dhwService: HeatPumpDhwService;
  quality: HeatPumpProfileQuality;
  methodologySourceId: string;
  license: string;
  /** At most one catalogue row may be the default for a given pair. */
  defaultFor: HeatPumpDefaultFor | null;
};

export type ResolveHeatPumpProfileInput = {
  technology: HeatPumpTechnologyInput;
  dhwService: HeatPumpDhwService;
  profileId?: string;
};

export type ResolvedHeatPumpProfile = {
  entry: HeatPumpCatalogueEntry;
  fallback: HeatPumpFallback;
  requestedTechnology: HeatPumpTechnologyInput;
  resolvedTechnology: HeatPumpTechnology;
};

export type HeatPumpProfileEnvelope = {
  schemaVersion: number;
  profileId: string;
  technology: HeatPumpTechnology;
  dhwService: HeatPumpDhwService;
  timeStepHours: number;
  steps: number;
  weights: number[];
  measuredAnnualElectricalKwh: number;
  quality: HeatPumpProfileQuality;
  methodologySourceId: string;
  license: string;
  generatorVersion: string;
  sourceWindow: string;
  fillSummary: HeatPumpFillSummary;
};

export type HeatPumpFillSummary = {
  nGapsRepaired: number;
  nSlotsFilled: number;
  addedElectricalKwh: number;
  rules: string;
  gaps: readonly unknown[];
};

export type CreateHeatPumpProfile15MinInput = {
  technology: HeatPumpTechnologyInput;
  annualElectricalKwh: number;
  dhwService: HeatPumpDhwService;
  /**
   * Simulation calendar year. Leap years omit 29 February; the measured
   * prototype is not remapped onto weekdays of `year`.
   */
  year: number;
  profileId?: string;
};

export type HeatPumpProfileMeta = {
  resolvedProfile: HeatPumpCatalogueEntry;
  scaleFactor: number;
  fallback: HeatPumpFallback;
  methodologySourceId: string;
  license: string;
  measuredAnnualElectricalKwh: number;
  year: number;
  leapDayOmitted: boolean;
  calendarRemap: false;
  timeStepHours: number;
  steps: number;
};

export type HeatPumpProfile15MinResult = {
  profile: number[];
  meta: HeatPumpProfileMeta;
};

export type ScaleUniformEnergyResult = {
  profile: number[];
  scaleFactor: number;
};
