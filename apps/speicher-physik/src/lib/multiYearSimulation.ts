import "server-only";
import {
  expandAlignedPvgisHourlyToQuarterHours,
  loadPVGISHourlyProfilesByYear,
} from "../../../../packages/pvgis-adapter";
import {
  DEFAULT_BATTERY_SPEC,
  DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH,
  DEFAULT_MULTI_YEAR_YEARS,
  DEFAULT_WEATHER_DATABASE,
  STEPS_PER_NON_LEAP_YEAR_15,
  TIME_STEP_HOURS_15,
  runPhysicalKernel,
  type BatterySpec,
  type PhysicalKernelResult,
} from "../../../../packages/pv-core";
import { toPVGISAspect } from "@/lib/toPVGISAspect";

export {
  DEFAULT_MULTI_YEAR_START,
  DEFAULT_MULTI_YEAR_END,
  DEFAULT_MULTI_YEAR_YEARS,
  DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH,
} from "../../../../packages/pv-core";

/** One roof PV plane for multi-roof (UI rooftop azimuth; converted internally for PVGIS). */
export type SpeicherPvSurfaceUi = {
  systemSizeKwP: number;
  tiltDeg: number;
  azimuthDeg: number;
};

export type SimulateMultiYearSpeicherGrenzParams = {
  /**
   * Load series for each weather year. Length must match `timeStepHours`
   * (8760 at dt=1, 35040 at dt=0.25).
   */
  getLoadForYear: (year: number) => number[];
  /**
   * Optional PV injector. When set, skips PVGIS fetches (unit tests).
   * Hourly 8760 arrays are expanded when `timeStepHours` is 0.25.
   * Production callers omit this and use lat/lon + surfaces.
   */
  getPvForYear?: (year: number) => number[] | Promise<number[]>;
  latitude: number;
  longitude: number;
  /**
   * When non-empty: one PVGIS range request per roof surface covering all
   * simulated years, then hourly PV summed per year before battery simulation
   * (UI rooftop azimuth in `azimuthDeg`).
   * When omitted/empty (legacy single-roof): use `pvSystemKwP`, `tiltDeg`, `azimuthDeg`
   * where `azimuthDeg` must be the PVGIS `aspect`, not UI azimuth.
   */
  pvSurfaces?: readonly SpeicherPvSurfaceUi[];
  /** Legacy single-roof kWp — required when `pvSurfaces` is missing or empty */
  pvSystemKwP?: number;
  tiltDeg?: number;
  azimuthDeg?: number;
  years?: ReadonlyArray<number>;
  batterySizes?: ReadonlyArray<number>;
  batterySpec?: BatterySpec;
  backupReserveKwh?: number;
  /**
   * Default false. Production SpeicherGrenze must leave this false.
   * When true, the kernel retains per-step series (see `hourlyBatterySizes`).
   */
  includeHourly?: boolean;
  /** If `includeHourly`, collect battery hourly series only for these sizes. */
  hourlyBatterySizes?: ReadonlyArray<number>;
  /**
   * Production: {@link TIME_STEP_HOURS_15} (0.25). Tests that inject 8760
   * arrays omit this (kernel default 1 h) or pass 1 explicitly.
   */
  timeStepHours?: number;
  weatherDatabase?: string;
  createdAt?: string;
};

/** Internal kernel result. Do not send this object to the browser. */
export type SimulateMultiYearSpeicherGrenzResult = PhysicalKernelResult;

/**
 * Hour-by-hour sum of several 8760h PVGIS profiles (must all be same length).
 */
export function sumHourlyProfiles(
  profiles: readonly (readonly number[])[]
): number[] {
  if (profiles.length === 0) {
    throw new Error("sumHourlyProfiles: at least one profile is required");
  }
  const n = profiles[0].length;
  for (let p = 1; p < profiles.length; p++) {
    if (profiles[p].length !== n) {
      throw new Error(
        `sumHourlyProfiles: hourly length mismatch (index 0 has ${n}h, index ${p} has ${profiles[p].length}h)`
      );
    }
  }
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let p = 0; p < profiles.length; p++) {
      sum += profiles[p][i];
    }
    out[i] = sum;
  }
  return out;
}

/**
 * One PVGIS range request per roof surface covering `years`, then combine
 * hourly PV (8760 h) year-by-year (UI azimuth each).
 *
 * Request count = number of surfaces (not surfaces × years).
 * Production then expands the combined hourly arrays to 35040
 * (sum surfaces hourly first, then split — lower memory than expand-then-sum).
 */
export async function loadCombinedHourlyPvByYear(
  latitude: number,
  longitude: number,
  years: readonly number[],
  surfaces: readonly SpeicherPvSurfaceUi[]
): Promise<Record<number, number[]>> {
  if (years.length === 0) {
    throw new Error("loadCombinedHourlyPvByYear: years must be non-empty");
  }
  if (surfaces.length === 0) {
    throw new Error("loadCombinedHourlyPvByYear: surfaces must be non-empty");
  }

  const startYear = Math.min(...years);
  const endYear = Math.max(...years);

  const perSurface = await Promise.all(
    surfaces.map((s) =>
      loadPVGISHourlyProfilesByYear({
        latitude,
        longitude,
        systemSizeKwP: s.systemSizeKwP,
        tiltDeg: s.tiltDeg,
        azimuthDeg: toPVGISAspect(s.azimuthDeg),
        startYear,
        endYear,
      })
    )
  );

  const out: Record<number, number[]> = {};
  for (const year of years) {
    const profiles: number[][] = [];
    for (let s = 0; s < perSurface.length; s++) {
      const profile = perSurface[s][year];
      if (!profile) {
        throw new Error(
          `PVGIS multi-year response missing year ${year} for surface ${s}`
        );
      }
      profiles.push(profile);
    }
    out[year] = sumHourlyProfiles(profiles);
  }
  return out;
}

/**
 * @deprecated Prefer {@link loadCombinedHourlyPvByYear} (one range request per surface).
 * Kept for callers that need a single year; still issues one range-capable fetch
 * scoped to that year only.
 */
export async function loadCombinedHourlyPvForYear(
  latitude: number,
  longitude: number,
  year: number,
  surfaces: readonly SpeicherPvSurfaceUi[]
): Promise<number[]> {
  const byYear = await loadCombinedHourlyPvByYear(
    latitude,
    longitude,
    [year],
    surfaces
  );
  return byYear[year];
}

function legacySinglePvParams(params: SimulateMultiYearSpeicherGrenzParams): {
  pvSystemKwP: number;
  tiltDeg: number;
  azimuthPvAspectDeg: number;
} {
  const kw = params.pvSystemKwP;
  const tilt = params.tiltDeg;
  const aspect = params.azimuthDeg;
  if (typeof kw !== "number" || !Number.isFinite(kw)) {
    throw new Error(
      "simulateMultiYearSpeicherGrenz: pvSystemKwP is required when pvSurfaces is empty"
    );
  }
  if (typeof tilt !== "number" || !Number.isFinite(tilt)) {
    throw new Error(
      "simulateMultiYearSpeicherGrenz: tiltDeg is required when pvSurfaces is empty"
    );
  }
  if (typeof aspect !== "number" || !Number.isFinite(aspect)) {
    throw new Error(
      "simulateMultiYearSpeicherGrenz: azimuthDeg (PVGIS aspect) is required when pvSurfaces is empty"
    );
  }
  return {
    pvSystemKwP: kw,
    tiltDeg: tilt,
    azimuthPvAspectDeg: aspect,
  };
}

function adaptPvToTimeStep(
  profile: number[],
  timeStepHours: number
): number[] {
  if (timeStepHours !== TIME_STEP_HOURS_15) return profile;
  if (profile.length === STEPS_PER_NON_LEAP_YEAR_15) return profile;
  return expandAlignedPvgisHourlyToQuarterHours(profile);
}

/**
 * I/O orchestrator: loads PVGIS profiles (unless injected), then runs the
 * physical kernel. Returns {@link PhysicalKernelResult} — keep it server-side.
 *
 * PVGIS: one range request per roof surface for the full year span (split +
 * align locally), unless `getPvForYear` is provided. When `timeStepHours` is
 * 0.25, aligned hourly PV is expanded with energy-conserving E/4 splits.
 */
export async function simulateMultiYearSpeicherGrenz(
  params: SimulateMultiYearSpeicherGrenzParams
): Promise<PhysicalKernelResult> {
  const years = (params.years ?? DEFAULT_MULTI_YEAR_YEARS).slice();
  const batterySizes = (
    params.batterySizes ?? DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH
  ).slice();
  const spec = params.batterySpec ?? DEFAULT_BATTERY_SPEC;
  const timeStepHours = params.timeStepHours;
  const useInjectedPv = typeof params.getPvForYear === "function";

  if (years.length === 0) {
    throw new Error("years must contain at least one year");
  }
  if (batterySizes.length === 0) {
    throw new Error("batterySizes must contain at least one size");
  }
  if (batterySizes.some((s) => !Number.isFinite(s) || s <= 0)) {
    throw new Error("batterySizes must contain only positive finite numbers");
  }

  const multiSurfaces =
    params.pvSurfaces && params.pvSurfaces.length > 0
      ? params.pvSurfaces.slice()
      : null;

  /** Prefetched combined PV profiles (one range request per surface). */
  let pvByYear: Record<number, number[]> | null = null;
  if (!useInjectedPv) {
    if (multiSurfaces !== null && multiSurfaces.length > 0) {
      pvByYear = await loadCombinedHourlyPvByYear(
        params.latitude,
        params.longitude,
        years,
        multiSurfaces
      );
    } else {
      const { pvSystemKwP, tiltDeg, azimuthPvAspectDeg } =
        legacySinglePvParams(params);
      const startYear = Math.min(...years);
      const endYear = Math.max(...years);
      const byYear = await loadPVGISHourlyProfilesByYear({
        latitude: params.latitude,
        longitude: params.longitude,
        systemSizeKwP: pvSystemKwP,
        tiltDeg: tiltDeg,
        azimuthDeg: azimuthPvAspectDeg,
        startYear,
        endYear,
      });
      pvByYear = {};
      for (const year of years) {
        const profile = byYear[year];
        if (!profile) {
          throw new Error(`PVGIS multi-year response missing year ${year}`);
        }
        pvByYear[year] = profile;
      }
    }
  }

  const pvMap: Record<number, number[]> = {};
  const loadMap: Record<number, number[]> = {};
  for (const year of years) {
    let pvProfile: number[];
    if (useInjectedPv) {
      pvProfile = await params.getPvForYear!(year);
    } else {
      pvProfile = pvByYear![year];
      if (!pvProfile) {
        throw new Error(`Missing prefetched PV profile for year ${year}`);
      }
    }
    pvMap[year] = adaptPvToTimeStep(pvProfile, timeStepHours ?? 1);
    loadMap[year] = params.getLoadForYear(year);
  }

  return runPhysicalKernel({
    years,
    batterySizes,
    getLoadForYear: (year) => loadMap[year],
    getPvForYear: (year) => pvMap[year],
    batterySpec: spec,
    backupReserveKwh: params.backupReserveKwh,
    timeStepHours,
    includeHourly: params.includeHourly === true,
    hourlyBatterySizes: params.hourlyBatterySizes,
    weatherDatabase:
      params.weatherDatabase ??
      (useInjectedPv ? "injected" : DEFAULT_WEATHER_DATABASE),
    createdAt: params.createdAt,
  });
}
