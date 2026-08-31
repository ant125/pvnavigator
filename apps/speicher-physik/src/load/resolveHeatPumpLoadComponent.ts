/**
 * SpeicherGrenze heat-pump load adapter.
 *
 * Production Luft/Wasser uses `@heatpump-profile/loader`. The synthetic
 * seasonal model in `./heatpump` is kept only as an explicit fallback when
 * that package cannot resolve a supported production profile.
 *
 * Legacy calculations that only send `heatPumpEnabled` + annual kWh resolve
 * as technology `"unknown"` and DHW service `"space_heat_and_dhw"`:
 * `"unknown"` already maps to Luft/Wasser in the profile package, and
 * heating + DHW is the safer default for a modern residential installation.
 *
 * Do not re-normalise the series here. Scaling belongs to the package.
 */

import {
  createHeatPumpProfile15Min,
  HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR,
  type HeatPumpDhwService,
  type HeatPumpFallback,
  type HeatPumpProfileQuality,
  type HeatPumpTechnology,
} from "@heatpump-profile/loader";
import { createHeatPumpComponent15Min } from "./heatpump";
import type { LoadComponent } from "./merge";

/** Production technology input for this phase. Wasser/Wasser is not exposed. */
export type HeatPumpTechnologyProduction = "luftwasser" | "unknown";

export type {
  HeatPumpDhwService,
  HeatPumpFallback,
  HeatPumpProfileQuality,
};

/**
 * Missing fields on stored / form inputs. `"unknown"` resolves to Luft/Wasser
 * in `@heatpump-profile/loader` (`meta.fallback = "unknown-uses-luftwasser"`).
 */
export const DEFAULT_HEAT_PUMP_TECHNOLOGY: HeatPumpTechnologyProduction =
  "unknown";

/** Safer residential default: the heat pump also supplies DHW. */
export const DEFAULT_HEAT_PUMP_DHW_SERVICE: HeatPumpDhwService =
  "space_heat_and_dhw";

const SUPPORTED_TECHNOLOGIES = new Set<HeatPumpTechnologyProduction>([
  "luftwasser",
  "unknown",
]);

const SUPPORTED_DHW = new Set<HeatPumpDhwService>([
  "space_heat_only",
  "space_heat_and_dhw",
]);

/** Relative tolerance for annual electrical energy after package scaling. */
const ANNUAL_SUM_REL_TOL = 1e-9;

export type HeatPumpMeasuredSourceClass =
  | "thermbuild-lab-prototype"
  | "synthetic-seasonal";

export type HeatPumpCalculationFallback =
  | HeatPumpFallback
  | "synthetic-seasonal";

export type HeatPumpCalculationMeta = {
  enabled: true;
  requestedTechnology: HeatPumpTechnologyProduction;
  resolvedTechnology: HeatPumpTechnology;
  dhwService: HeatPumpDhwService;
  /**
   * True when technology and/or DHW service were filled from
   * {@link DEFAULT_HEAT_PUMP_TECHNOLOGY} / {@link DEFAULT_HEAT_PUMP_DHW_SERVICE}.
   */
  usedLegacyDefaults: boolean;
  profileId: string | null;
  quality: HeatPumpProfileQuality | null;
  methodologySourceId: string | null;
  fallback: HeatPumpCalculationFallback;
  measuredSourceClass: HeatPumpMeasuredSourceClass;
  usedSyntheticFallback: boolean;
  year: number;
  scaleFactor: number | null;
  license: string | null;
  measuredAnnualElectricalKwh: number | null;
};

export type HeatPumpLoadComponentResult = {
  component: LoadComponent;
  meta: HeatPumpCalculationMeta;
};

export type BuildHeatPumpLoadComponentInput = {
  annualElectricalKwh: number;
  year: number;
  /** Absent on legacy inputs → {@link DEFAULT_HEAT_PUMP_TECHNOLOGY}. */
  technology?: HeatPumpTechnologyProduction;
  /** Absent on legacy inputs → {@link DEFAULT_HEAT_PUMP_DHW_SERVICE}. */
  dhwService?: HeatPumpDhwService;
};

export function resolveHeatPumpSelectionDefaults(input: {
  technology?: HeatPumpTechnologyProduction;
  dhwService?: HeatPumpDhwService;
}): {
  technology: HeatPumpTechnologyProduction;
  dhwService: HeatPumpDhwService;
  usedLegacyDefaults: boolean;
} {
  const usedLegacyDefaults =
    input.technology === undefined || input.dhwService === undefined;
  return {
    technology: input.technology ?? DEFAULT_HEAT_PUMP_TECHNOLOGY,
    dhwService: input.dhwService ?? DEFAULT_HEAT_PUMP_DHW_SERVICE,
    usedLegacyDefaults,
  };
}

/**
 * Build the 15-minute heat-pump load component for SpeicherGrenze.
 *
 * Luft/Wasser (including `"unknown"` → Luft/Wasser) must resolve from the
 * measured catalogue. Unexpected resolution errors fail loudly. Do not use
 * {@link buildSyntheticHeatPumpFallbackComponent} as a silent substitute
 * for a supported ThermBuild profile.
 */
export function buildHeatPumpLoadComponent(
  input: BuildHeatPumpLoadComponentInput
): HeatPumpLoadComponentResult {
  const { technology, dhwService, usedLegacyDefaults } =
    resolveHeatPumpSelectionDefaults(input);
  const annualElectricalKwh = input.annualElectricalKwh;
  const year = input.year;

  validateHeatPumpInputs(annualElectricalKwh, technology, dhwService);

  const result = createHeatPumpProfile15Min({
    technology,
    annualElectricalKwh,
    dhwService,
    year,
  });
  assertValidHeatPumpProfile(result.profile, annualElectricalKwh);
  const resolved = result.meta.resolvedProfile;
  return {
    component: {
      name: "heatPump",
      yearlyConsumption: annualElectricalKwh,
      profile: result.profile,
    },
    meta: {
      enabled: true,
      requestedTechnology: technology,
      resolvedTechnology: resolved.technology,
      dhwService,
      usedLegacyDefaults,
      profileId: resolved.profileId,
      quality: resolved.quality,
      methodologySourceId: result.meta.methodologySourceId,
      fallback: result.meta.fallback,
      measuredSourceClass: "thermbuild-lab-prototype",
      usedSyntheticFallback: false,
      year,
      scaleFactor: result.meta.scaleFactor,
      license: result.meta.license,
      measuredAnnualElectricalKwh: result.meta.measuredAnnualElectricalKwh,
    },
  };
}

/**
 * Explicit synthetic seasonal fallback. Not the Luft/Wasser default.
 * Callers must record `meta.usedSyntheticFallback` — never substitute this
 * silently for a ThermBuild profile that should have resolved.
 */
export function buildSyntheticHeatPumpFallbackComponent(params: {
  annualElectricalKwh: number;
  year: number;
  technology: HeatPumpTechnologyProduction;
  dhwService: HeatPumpDhwService;
  usedLegacyDefaults: boolean;
}): HeatPumpLoadComponentResult {
  validateHeatPumpInputs(
    params.annualElectricalKwh,
    params.technology,
    params.dhwService
  );
  const component = createHeatPumpComponent15Min(params.annualElectricalKwh);
  assertValidHeatPumpProfile(component.profile, params.annualElectricalKwh);
  return {
    component,
    meta: {
      enabled: true,
      requestedTechnology: params.technology,
      resolvedTechnology: "luftwasser",
      dhwService: params.dhwService,
      usedLegacyDefaults: params.usedLegacyDefaults,
      profileId: null,
      quality: null,
      methodologySourceId: null,
      fallback: "synthetic-seasonal",
      measuredSourceClass: "synthetic-seasonal",
      usedSyntheticFallback: true,
      year: params.year,
      scaleFactor: null,
      license: null,
      measuredAnnualElectricalKwh: null,
    },
  };
}

function validateHeatPumpInputs(
  annualElectricalKwh: number,
  technology: HeatPumpTechnologyProduction,
  dhwService: HeatPumpDhwService
): void {
  if (!Number.isFinite(annualElectricalKwh) || annualElectricalKwh <= 0) {
    throw new Error(
      "heatPump: annualElectricalKwh must be a positive finite number"
    );
  }
  if (!SUPPORTED_TECHNOLOGIES.has(technology)) {
    throw new Error(
      `Unsupported heat-pump technology for this phase: ${String(technology)}`
    );
  }
  if (!SUPPORTED_DHW.has(dhwService)) {
    throw new Error(
      `Unsupported heat-pump dhwService: ${String(dhwService)}`
    );
  }
}

function assertValidHeatPumpProfile(
  profile: readonly number[],
  annualElectricalKwh: number
): void {
  if (profile.length !== HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR) {
    throw new Error(
      `heatPump: profile length ${profile.length}, expected ${HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR}`
    );
  }
  let sum = 0;
  for (let i = 0; i < profile.length; i++) {
    const v = profile[i];
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`heatPump: invalid value at index ${i}`);
    }
    sum += v;
  }
  const tol = ANNUAL_SUM_REL_TOL * Math.max(1, annualElectricalKwh);
  if (Math.abs(sum - annualElectricalKwh) > tol) {
    throw new Error(
      `heatPump: annual sum ${sum} ≠ requested ${annualElectricalKwh}`
    );
  }
}
