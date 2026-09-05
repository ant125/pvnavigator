/**
 * EV v1 grid, version, and numerical implementation guards.
 *
 * Energy epsilon and solver iteration limits are implementation guards,
 * not customer-facing physical methodology (speicher-physics-model §2.4).
 */

export const EV_MODEL_VERSION = "1.0.0";

/** Quarter-hour steps on the production non-leap grid (365 × 96). */
export const EV_STEPS_PER_NON_LEAP_YEAR = 35040;

/** Quarter-hour slots in one civil day. */
export const EV_SLOTS_PER_DAY = 96;

/** Duration of one production step in hours (Δt). */
export const EV_TIME_STEP_HOURS = 0.25;

/** Fixed non-leap reference mix for mileage-consistency metadata only. */
export const EV_REFERENCE_WD_DAYS = 261;
export const EV_REFERENCE_SA_DAYS = 52;
export const EV_REFERENCE_SU_DAYS = 52;

export const EV_REFERENCE_DAY_COUNTS = {
  WD: EV_REFERENCE_WD_DAYS,
  SA: EV_REFERENCE_SA_DAYS,
  SU: EV_REFERENCE_SU_DAYS,
} as const;

export const EV_METHODOLOGY_SOURCE_IDS = [
  "ev-v1-generated-load",
  "ev-v1-annual-km-normalization",
  "ev-v1-wd-sa-su-timing",
  "ev-v1-workplace-event-placement",
  "ev-v1-vehicle-energy-buffer",
  "ev-v1-cyclic-year-boundary",
  "ev-v1-unmanaged-home-charging",
  "ev-v1-consumption-as-charging-energy",
] as const;

/**
 * Absolute energy tolerance (kWh) for conservation, cyclic closure, and
 * residual-km checks. Conservative vs float64 accumulation over 35 040
 * additions (typical slot energy ≲ a few kWh). Not a physical rule.
 */
export const EV_ENERGY_ABS_TOL_KWH = 1e-6;

/**
 * Relative energy tolerance paired with {@link EV_ENERGY_ABS_TOL_KWH}.
 * Used for large annual totals so 1e-6 kWh remains the floor.
 */
export const EV_ENERGY_REL_TOL = 1e-9;

/**
 * Maximum repeated-year warm-up passes, including the first discarded
 * seed pass. A 1-D bounded energy map typically closes in 2–4 passes;
 * 64 is a conservative failure guard, not a modelled customer horizon.
 */
export const EV_SOLVER_MAX_PASSES = 64;
