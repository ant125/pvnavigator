/**
 * SpeicherGrenze EV load adapter.
 *
 * Thin orchestration around `@ev-profile/loader`. Calendar-dependent: call
 * {@link resolveEvLoadComponentForYear} for every target weather year.
 * Do not cache one year and reuse it for another.
 *
 * No EV physics or scheduling lives here. Hidden behavioural defaults are
 * not applied. Workplace energy never enters the household load component.
 */

import {
  createEvProfile,
  EV_ENERGY_ABS_TOL_KWH,
  EV_ENERGY_REL_TOL,
  EV_STEPS_PER_NON_LEAP_YEAR,
  EvProfileError,
  preflightEvProfile,
  type CreateEvProfileInput,
  type EvErrorCode,
  type EvIssue,
  type EvProfileMeta,
  type EvTypicalDailyKm,
} from "@ev-profile/loader";
import type { LoadComponent } from "./merge";

export type {
  CreateEvProfileInput,
  EvErrorCode,
  EvHomeWindow,
  EvHomeWindows,
  EvProfileMeta,
  EvTypicalDailyKm,
  EvWorkplaceInput,
} from "@ev-profile/loader";

/** Public package EV input without `year` — the weather-year loop supplies it. */
export type EvCalculationConfig = Omit<CreateEvProfileInput, "year">;

/**
 * Optional calculation EV configuration.
 * Absent or `enabled: false` keeps the legacy household (+ HP) load.
 * `enabled: true` requires a complete package input; nothing is fabricated.
 */
export type EvCalculationInput =
  | { enabled: false }
  | ({ enabled: true } & EvCalculationConfig);

export type EvLoadComponentResult = {
  component: LoadComponent;
  meta: EvProfileMeta;
};

export type EvCalculationMeta = {
  enabled: true;
  modelVersion: string;
  methodologySourceIds: readonly string[];
  years: number[];
  /** Package metadata for every weather year. Do not pick one year silently. */
  byYear: Record<number, EvProfileMeta>;
  /**
   * Year-independent typical distances actually used.
   * Taken from the enabled calculation config, not from a silent years[0] pick.
   */
  typicalDailyKm: EvTypicalDailyKm;
  /**
   * Annual driving-energy demand. Identical for every weather year;
   * asserted, not taken from a silent years[0] pick.
   */
  annualDrivingDemandKwh: number;
  /** Mean of `homeChargedKwh` across `years`. */
  averageHomeChargedKwh: number;
  /** Mean of `workplaceAcceptedKwh` across `years`. */
  averageWorkplaceAcceptedKwh: number;
  /** Mean of `workplaceRejectedKwh` across `years`. */
  averageWorkplaceRejectedKwh: number;
};

const REQUIRED_EV_CONFIG_KEYS = [
  "annualKm",
  "consumptionKwhPer100Km",
  "usableBatteryCapacityKwh",
  "typicalDailyKm",
  "maxHomeChargePowerKw",
  "homeWindow",
  "workplace",
] as const satisfies readonly (keyof EvCalculationConfig)[];

function assertCompleteEvConfig(
  ev: { enabled: true } & Partial<EvCalculationConfig>
): asserts ev is { enabled: true } & EvCalculationConfig {
  const missing = REQUIRED_EV_CONFIG_KEYS.filter(
    (key) => ev[key] === undefined || ev[key] === null
  );
  if (missing.length > 0) {
    throw new Error(
      `ev: enabled configuration is missing required fields: ${missing.join(", ")}`
    );
  }
}

function evConfigFromEnabled(
  ev: { enabled: true } & Partial<EvCalculationConfig>
): EvCalculationConfig {
  assertCompleteEvConfig(ev);
  return {
    annualKm: ev.annualKm,
    consumptionKwhPer100Km: ev.consumptionKwhPer100Km,
    usableBatteryCapacityKwh: ev.usableBatteryCapacityKwh,
    typicalDailyKm: ev.typicalDailyKm,
    maxHomeChargePowerKw: ev.maxHomeChargePowerKw,
    homeWindow: ev.homeWindow,
    workplace: ev.workplace,
  };
}

/**
 * Resolve a complete EV config or `null` when EV is absent/disabled.
 * Does not invent missing values.
 */
export function resolveEnabledEvConfig(
  ev: EvCalculationInput | undefined
): EvCalculationConfig | null {
  if (ev == null || ev.enabled !== true) {
    return null;
  }
  return evConfigFromEnabled(ev);
}

function throwFromPreflightIssues(
  year: number,
  kind: "invalid_input" | "infeasible",
  issues: EvIssue[]
): never {
  const issue = issues[0];
  throw new EvProfileError(
    (issue?.code as EvErrorCode | undefined) ?? "INVALID_YEAR",
    kind,
    issue?.message ?? `ev: preflight failed for year ${year}`,
    { year, issues: issue?.details }
  );
}

/**
 * Package physical preflight for every target weather year.
 * Call before PVGIS / heavy simulation.
 */
export function preflightEvLoadForYears(params: {
  evInput: EvCalculationConfig;
  years: readonly number[];
}): void {
  if (params.years.length === 0) {
    throw new Error("ev: at least one weather year is required for preflight");
  }
  for (const year of params.years) {
    const result = preflightEvProfile({ ...params.evInput, year });
    if (!result.ok) {
      throwFromPreflightIssues(year, result.kind, result.issues);
    }
  }
}

function sumProfile(profile: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < profile.length; i++) {
    const value = profile[i];
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`ev: invalid value at index ${i}`);
    }
    total += value;
  }
  return total;
}

function energyWithinTolerance(actual: number, expected: number): boolean {
  const scale = Math.max(Math.abs(actual), Math.abs(expected), 1);
  return (
    Math.abs(actual - expected) <=
    Math.max(EV_ENERGY_ABS_TOL_KWH, EV_ENERGY_REL_TOL * scale)
  );
}

/**
 * Create the home-charging load component for one target weather year.
 * Must not be reused across years.
 */
export function resolveEvLoadComponentForYear(params: {
  evInput: EvCalculationConfig;
  year: number;
}): EvLoadComponentResult {
  const result = createEvProfile({
    ...params.evInput,
    year: params.year,
  });
  const yearlyConsumption = result.meta.homeChargedKwh;
  if (result.profile.length !== EV_STEPS_PER_NON_LEAP_YEAR) {
    throw new Error(
      `ev: profile length ${result.profile.length}, expected ${EV_STEPS_PER_NON_LEAP_YEAR}`
    );
  }
  const profileSum = sumProfile(result.profile);
  if (!energyWithinTolerance(profileSum, yearlyConsumption)) {
    throw new Error(
      `ev: yearlyConsumption ${yearlyConsumption} ≠ profile sum ${profileSum}`
    );
  }
  return {
    component: {
      name: "ev",
      yearlyConsumption,
      profile: result.profile,
    },
    meta: result.meta,
  };
}

function meanAcrossYears(
  byYear: Record<number, EvProfileMeta>,
  years: readonly number[],
  read: (meta: EvProfileMeta) => number
): number {
  let sum = 0;
  for (const year of years) {
    const meta = byYear[year];
    if (!meta) {
      throw new Error(`ev: missing metadata for year ${year}`);
    }
    sum += read(meta);
  }
  return sum / years.length;
}

function yearIndependentNumber(
  byYear: Record<number, EvProfileMeta>,
  years: readonly number[],
  read: (meta: EvProfileMeta) => number,
  name: string
): number {
  const first = byYear[years[0]];
  if (!first) {
    throw new Error(`ev: missing metadata for year ${years[0]}`);
  }
  const expected = read(first);
  for (const year of years) {
    const meta = byYear[year];
    if (!meta) {
      throw new Error(`ev: missing metadata for year ${year}`);
    }
    if (read(meta) !== expected) {
      throw new Error(`ev: ${name} is not identical across weather years`);
    }
  }
  return expected;
}

export function buildEvCalculationMeta(
  byYear: Record<number, EvProfileMeta>,
  years: readonly number[],
  config: EvCalculationConfig
): EvCalculationMeta {
  if (years.length === 0) {
    throw new Error("ev: cannot build calculation metadata without years");
  }
  for (const year of years) {
    if (!byYear[year]) {
      throw new Error(`ev: missing metadata for year ${year}`);
    }
  }
  const first = byYear[years[0]]!;
  return {
    enabled: true,
    modelVersion: first.modelVersion,
    methodologySourceIds: first.methodologySourceIds,
    years: years.slice(),
    byYear,
    typicalDailyKm: {
      WD: config.typicalDailyKm.WD,
      SA: config.typicalDailyKm.SA,
      SU: config.typicalDailyKm.SU,
    },
    annualDrivingDemandKwh: yearIndependentNumber(
      byYear,
      years,
      (meta) => meta.annualDrivingDemandKwh,
      "annualDrivingDemandKwh"
    ),
    averageHomeChargedKwh: meanAcrossYears(
      byYear,
      years,
      (meta) => meta.homeChargedKwh
    ),
    averageWorkplaceAcceptedKwh: meanAcrossYears(
      byYear,
      years,
      (meta) => meta.workplaceAcceptedKwh
    ),
    averageWorkplaceRejectedKwh: meanAcrossYears(
      byYear,
      years,
      (meta) => meta.workplaceRejectedKwh
    ),
  };
}
