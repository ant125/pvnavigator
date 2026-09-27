/**
 * Display model for the Überblick comparison «Was bringt Ihnen der Speicher?».
 * Bar lengths and the stated gain use unrounded calculation results.
 * Rounding happens only when a number is turned into a label.
 */

/** 1–10 × 10ⁿ, including 1.5 and 2.5, so 6 508 kWh ceilings to 7 000. */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type SpeicherBenefitQuantity = {
  /** Finite source value, or null when the result does not contain it. */
  raw: number | null;
  /**
   * Share of the shared kWh scale, 0–100.
   * Null when the kWh value itself is missing. Never produced by dividing by 0.
   */
  fillPercent: number | null;
};

export type SpeicherBenefitAutarkie = {
  /** Math.round of the unrounded ratio. Null when Autarkie cannot be formed. */
  displayPct: number | null;
  /**
   * Width of the solar segment on a bar that means 100 % of consumption.
   * Clamped to 0–100. Null when Autarkie is missing.
   */
  solarPercent: number | null;
};

export type SpeicherBenefitComparisonModel = {
  /** Shared linear scale ceiling. 0 when every present value is 0. Null when both are missing. */
  scaleMaxKwh: number | null;
  ohne: SpeicherBenefitQuantity;
  mit: SpeicherBenefitQuantity;
  /**
   * Math.round(mit − ohne) from the raw kWh values.
   * Null when either value is missing. Not the difference of already rounded labels.
   */
  gainKwhRounded: number | null;
  autarkieOhne: SpeicherBenefitAutarkie;
  autarkieMit: SpeicherBenefitAutarkie;
  /**
   * Math.round(100 − unrounded Autarkie with storage).
   * Null when that Autarkie is missing.
   */
  gridShareWithStorageRoundedPct: number | null;
};

export type SpeicherBenefitComparisonInput = {
  eigenverbrauchOhneKwh?: number | null;
  eigenverbrauchMitKwh?: number | null;
  autarkieOhneUnroundedPct?: number | null;
  autarkieMitUnroundedPct?: number | null;
};

function asFinite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Ceiling for a kWh axis. Non-positive and non-finite inputs return 0 so
 * callers can skip the division.
 */
export function niceEnergyScaleMaxKwh(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 0;

  const exponent = Math.floor(Math.log10(maxValue));
  const magnitude = 10 ** exponent;
  const fraction = maxValue / magnitude;
  let step: number = NICE_STEPS[NICE_STEPS.length - 1];
  for (const candidate of NICE_STEPS) {
    if (fraction <= candidate + 1e-9) {
      step = candidate;
      break;
    }
  }

  return Number((step * magnitude).toPrecision(12));
}

function energyQuantity(
  raw: number | null,
  scaleMaxKwh: number | null
): SpeicherBenefitQuantity {
  if (raw === null || scaleMaxKwh === null) {
    return { raw, fillPercent: null };
  }
  if (!(scaleMaxKwh > 0)) {
    return { raw, fillPercent: 0 };
  }
  if (raw <= 0) {
    return { raw, fillPercent: 0 };
  }
  return {
    raw,
    fillPercent: Math.min(100, (raw / scaleMaxKwh) * 100),
  };
}

function autarkieQuantity(unroundedPct: number | null): SpeicherBenefitAutarkie {
  if (unroundedPct === null) {
    return { displayPct: null, solarPercent: null };
  }
  return {
    displayPct: Math.round(unroundedPct),
    solarPercent: Math.min(100, Math.max(0, unroundedPct)),
  };
}

export function buildSpeicherBenefitComparison(
  input: SpeicherBenefitComparisonInput
): SpeicherBenefitComparisonModel {
  const ohneKwh = asFinite(input.eigenverbrauchOhneKwh);
  const mitKwh = asFinite(input.eigenverbrauchMitKwh);
  const plottable = [ohneKwh, mitKwh].filter(
    (value): value is number => value !== null && value >= 0
  );

  let scaleMaxKwh: number | null = null;
  if (plottable.length > 0) {
    const max = Math.max(...plottable);
    scaleMaxKwh = max === 0 ? 0 : niceEnergyScaleMaxKwh(max);
  }

  const autarkieMit = asFinite(input.autarkieMitUnroundedPct);

  return {
    scaleMaxKwh,
    ohne: energyQuantity(ohneKwh, scaleMaxKwh),
    mit: energyQuantity(mitKwh, scaleMaxKwh),
    gainKwhRounded:
      ohneKwh === null || mitKwh === null ? null : Math.round(mitKwh - ohneKwh),
    autarkieOhne: autarkieQuantity(asFinite(input.autarkieOhneUnroundedPct)),
    autarkieMit: autarkieQuantity(autarkieMit),
    gridShareWithStorageRoundedPct:
      autarkieMit === null ? null : Math.round(100 - autarkieMit),
  };
}
