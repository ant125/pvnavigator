/**
 * SpeicherGrenze EV v1 home-charging profile.
 *
 * Pure module: no app imports, no filesystem, no PVGIS, no stationary
 * battery physics, no report copy. Hidden behavioural defaults are not
 * applied. User-entered kWh/100 km is the charging-energy input.
 *
 * Calendar WD/SA/SU classification is reused from `@bdew-profile/loader/calendar`.
 *
 * Do not import in client components.
 */

export {
  EV_ENERGY_ABS_TOL_KWH,
  EV_ENERGY_REL_TOL,
  EV_METHODOLOGY_SOURCE_IDS,
  EV_MODEL_VERSION,
  EV_REFERENCE_DAY_COUNTS,
  EV_SLOTS_PER_DAY,
  EV_SOLVER_MAX_PASSES,
  EV_STEPS_PER_NON_LEAP_YEAR,
  EV_TIME_STEP_HOURS,
} from "./constants";
export { createEvProfile } from "./createEvProfile";
export { EvProfileError } from "./errors";
export { preflightEvProfile } from "./preflight";
export {
  evClock,
  evWindowBounded,
  evWindowFullDay,
  evWindowUnavailable,
} from "./windows";
export { workplaceIndex } from "./workplace";
export type {
  CreateEvProfileInput,
  EvAvailability,
  EvClockTime,
  EvDayCounts,
  EvDayType,
  EvErrorCode,
  EvHomeWindow,
  EvHomeWindows,
  EvIssue,
  EvIssueKind,
  EvModelDay,
  EvNotableCode,
  EvPreflightResult,
  EvProfile15MinResult,
  EvProfileMeta,
  EvSolverGuards,
  EvTypicalDailyKm,
  EvWorkplaceEvent,
  EvWorkplaceInput,
  EvYearPass,
} from "./types";
