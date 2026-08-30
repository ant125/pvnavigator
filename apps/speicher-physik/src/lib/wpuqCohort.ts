import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { STEPS_PER_NON_LEAP_YEAR_15 } from "../../../../packages/pv-core";

export const WPUQ_COHORT_SIZE = 27;
export const WPUQ_PACKED_ANNUAL_KWH = 5000;

export type WpuqCohortProfile = {
  houseId: string;
  /** 35040 interval energies (kWh). Packed at 5000 kWh/year; scale before use. */
  intervalEnergyKwh: Float64Array;
};

export type WpuqCohort = {
  houseIds: readonly string[];
  profiles: readonly WpuqCohortProfile[];
};

function resolveWpuqDir(): string {
  const candidates = [
    path.join(process.cwd(), "data/wpuq"),
    path.join(process.cwd(), "apps/speicher-physik/data/wpuq"),
    path.resolve(__dirname, "../../data/wpuq"),
    path.resolve(__dirname, "../../../data/wpuq"),
    path.resolve(__dirname, "../../../../apps/speicher-physik/data/wpuq"),
  ];
  for (const dir of candidates) {
    if (
      existsSync(path.join(dir, "cohort.meta.json")) &&
      existsSync(path.join(dir, "cohort.f64le"))
    ) {
      return dir;
    }
  }
  throw new Error(
    "WPuQ cohort pack not found (data/wpuq/cohort.meta.json + cohort.f64le). Run apps/speicher-physik/scripts/packWpuqCohort.cjs."
  );
}

let cached: WpuqCohort | null = null;

export function loadWpuqCohort(): WpuqCohort {
  if (cached) return cached;

  const dir = resolveWpuqDir();
  const meta = JSON.parse(
    readFileSync(path.join(dir, "cohort.meta.json"), "utf8")
  ) as {
    houseIds: string[];
    steps: number;
    packedAnnualKwh: number;
    houseCount: number;
  };

  if (meta.houseCount !== WPUQ_COHORT_SIZE || meta.houseIds.length !== WPUQ_COHORT_SIZE) {
    throw new Error(
      `WPuQ cohort must contain exactly ${WPUQ_COHORT_SIZE} houses, got ${meta.houseIds.length}`
    );
  }
  if (meta.steps !== STEPS_PER_NON_LEAP_YEAR_15) {
    throw new Error(
      `WPuQ cohort steps ${meta.steps}, expected ${STEPS_PER_NON_LEAP_YEAR_15}`
    );
  }

  const buf = readFileSync(path.join(dir, "cohort.f64le"));
  const expectedBytes = WPUQ_COHORT_SIZE * STEPS_PER_NON_LEAP_YEAR_15 * 8;
  if (buf.length !== expectedBytes) {
    throw new Error(
      `WPuQ cohort binary length ${buf.length}, expected ${expectedBytes}`
    );
  }

  const profiles: WpuqCohortProfile[] = meta.houseIds.map((houseId, index) => {
    const byteOffset = index * STEPS_PER_NON_LEAP_YEAR_15 * 8;
    const intervalEnergyKwh = new Float64Array(STEPS_PER_NON_LEAP_YEAR_15);
    for (let i = 0; i < STEPS_PER_NON_LEAP_YEAR_15; i++) {
      intervalEnergyKwh[i] = buf.readDoubleLE(byteOffset + i * 8);
    }
    return { houseId, intervalEnergyKwh };
  });

  cached = { houseIds: meta.houseIds, profiles };
  return cached;
}

/**
 * Scale a 15-minute household series so its annual sum equals `targetAnnualKwh`.
 * Shape is preserved. Does not mutate the input.
 */
export function scaleProfileToAnnualKwh(
  profile: ArrayLike<number>,
  targetAnnualKwh: number,
  label = "profile"
): number[] {
  if (!Number.isFinite(targetAnnualKwh) || targetAnnualKwh <= 0) {
    throw new Error(`${label}: targetAnnualKwh must be a positive finite number`);
  }
  if (profile.length !== STEPS_PER_NON_LEAP_YEAR_15) {
    throw new Error(
      `${label}: expected ${STEPS_PER_NON_LEAP_YEAR_15} steps, got ${profile.length}`
    );
  }

  let sum = 0;
  for (let i = 0; i < profile.length; i++) {
    const v = profile[i];
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`${label}: invalid interval at ${i}`);
    }
    sum += v;
  }
  if (!(sum > 0)) {
    throw new Error(`${label}: annual sum must be positive`);
  }

  const scale = targetAnnualKwh / sum;
  const out = new Array<number>(profile.length);
  let outSum = 0;
  for (let i = 0; i < profile.length; i++) {
    const v = profile[i] * scale;
    out[i] = v;
    outSum += v;
  }
  if (Math.abs(outSum - targetAnnualKwh) > 1e-6 * Math.max(1, targetAnnualKwh)) {
    throw new Error(
      `${label}: scaled annual ${outSum} ≠ target ${targetAnnualKwh}`
    );
  }
  return out;
}
