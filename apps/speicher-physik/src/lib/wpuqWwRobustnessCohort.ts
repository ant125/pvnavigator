import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { STEPS_PER_NON_LEAP_YEAR_15 } from "../../../../packages/pv-core";

/**
 * Packed Wasser/Wasser robustness cohort (24 independent measured houses).
 * Research source: research/wpuq/processed/robustness/. Not catalogued for
 * production heat-pump selection — SFH38 remains the only production profile.
 */

export const WPUQ_WW_ROBUSTNESS_SIZE = 24;

export type WpuqWwRobustnessProfile = {
  houseId: string;
  profileId: string;
  /** Unit-sum weights (35040). Scale with scaleUniformEnergy before use. */
  weights: Float64Array;
};

export type WpuqWwRobustnessCohort = {
  houseIds: readonly string[];
  profileIds: readonly string[];
  profiles: readonly WpuqWwRobustnessProfile[];
};

function resolveWwRobustnessDir(): string {
  const candidates = [
    path.join(process.cwd(), "data/wpuq"),
    path.join(process.cwd(), "apps/speicher-physik/data/wpuq"),
    path.resolve(__dirname, "../../data/wpuq"),
    path.resolve(__dirname, "../../../data/wpuq"),
    path.resolve(__dirname, "../../../../apps/speicher-physik/data/wpuq"),
  ];
  for (const dir of candidates) {
    if (
      existsSync(path.join(dir, "ww-robustness.meta.json")) &&
      existsSync(path.join(dir, "ww-robustness.f64le"))
    ) {
      return dir;
    }
  }
  throw new Error(
    "WW robustness pack not found (data/wpuq/ww-robustness.meta.json + ww-robustness.f64le). Run apps/speicher-physik/scripts/packWwRobustnessCohort.cjs."
  );
}

let cached: WpuqWwRobustnessCohort | null = null;

export function loadWpuqWwRobustnessCohort(): WpuqWwRobustnessCohort {
  if (cached) return cached;

  const dir = resolveWwRobustnessDir();
  const meta = JSON.parse(
    readFileSync(path.join(dir, "ww-robustness.meta.json"), "utf8")
  ) as {
    houseIds: string[];
    profileIds: string[];
    steps: number;
    houseCount: number;
    packedAs?: string;
    averaged?: boolean;
    clustered?: boolean;
  };

  if (
    meta.houseCount !== WPUQ_WW_ROBUSTNESS_SIZE ||
    meta.houseIds.length !== WPUQ_WW_ROBUSTNESS_SIZE ||
    meta.profileIds.length !== WPUQ_WW_ROBUSTNESS_SIZE
  ) {
    throw new Error(
      `WW robustness cohort must contain exactly ${WPUQ_WW_ROBUSTNESS_SIZE} houses, got ${meta.houseIds.length}`
    );
  }
  if (meta.steps !== STEPS_PER_NON_LEAP_YEAR_15) {
    throw new Error(
      `WW robustness steps ${meta.steps}, expected ${STEPS_PER_NON_LEAP_YEAR_15}`
    );
  }
  if (meta.averaged === true || meta.clustered === true) {
    throw new Error("WW robustness pack must not be averaged or clustered");
  }
  if (meta.packedAs !== undefined && meta.packedAs !== "unit_weights") {
    throw new Error(
      `WW robustness pack packedAs ${meta.packedAs}, expected unit_weights`
    );
  }

  const buf = readFileSync(path.join(dir, "ww-robustness.f64le"));
  const expectedBytes =
    WPUQ_WW_ROBUSTNESS_SIZE * STEPS_PER_NON_LEAP_YEAR_15 * 8;
  if (buf.length !== expectedBytes) {
    throw new Error(
      `WW robustness binary length ${buf.length}, expected ${expectedBytes}`
    );
  }

  const profiles: WpuqWwRobustnessProfile[] = meta.houseIds.map(
    (houseId, index) => {
      const profileId = meta.profileIds[index];
      const byteOffset = index * STEPS_PER_NON_LEAP_YEAR_15 * 8;
      const weights = new Float64Array(STEPS_PER_NON_LEAP_YEAR_15);
      let sum = 0;
      for (let i = 0; i < STEPS_PER_NON_LEAP_YEAR_15; i++) {
        const w = buf.readDoubleLE(byteOffset + i * 8);
        weights[i] = w;
        sum += w;
      }
      if (!(sum > 0) || Math.abs(sum - 1) > 1e-6) {
        throw new Error(
          `${profileId}: packed weight sum ${sum}, expected ~1`
        );
      }
      return { houseId, profileId, weights };
    }
  );

  cached = {
    houseIds: meta.houseIds,
    profileIds: meta.profileIds,
    profiles,
  };
  return cached;
}
