/**
 * WPuQ Phase 3 — export unmodified production heat-pump profile.
 *
 * Research only. Does not change createHeatPumpComponent15Min.
 *
 * Run from repo root:
 *   npx tsx --tsconfig apps/speicher-physik/tsconfig.json \
 *     research/wpuq/scripts/export_production_hp_profile.ts
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createHeatPumpComponent15Min } from "../../../apps/speicher-physik/src/load/heatpump.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPO = path.resolve(ROOT, "../..");
const PROCESSED = path.join(ROOT, "processed");
const CONFIG_PATH = path.join(ROOT, "phase3_config.json");

type Phase3Config = {
  target_annual_kwh: number;
  steps_expected: number;
  normalize_tolerance_kwh: number;
};

async function main(): Promise<void> {
  const config = JSON.parse(
    await readFile(CONFIG_PATH, "utf8")
  ) as Phase3Config;
  const annual = config.target_annual_kwh;
  const expected = config.steps_expected;
  const tol = config.normalize_tolerance_kwh;

  const hp = createHeatPumpComponent15Min(annual);
  const profile = hp.profile;
  const sum = profile.reduce((a, b) => a + b, 0);

  if (profile.length !== expected) {
    throw new Error(
      `createHeatPumpComponent15Min(${annual}): length ${profile.length}, expected ${expected}`
    );
  }
  if (Math.abs(sum - annual) > tol) {
    throw new Error(
      `createHeatPumpComponent15Min(${annual}): sum ${sum} != ${annual} (tol ${tol})`
    );
  }

  await mkdir(PROCESSED, { recursive: true });
  const outPath = path.join(PROCESSED, "production_hp_4000_2019.json");
  const payload = {
    source_function: "createHeatPumpComponent15Min",
    source_file: "apps/speicher-physik/src/load/heatpump.ts",
    unmodified: true,
    year: 2019,
    annual_kwh: annual,
    interval_count: profile.length,
    timestep_hours: 0.25,
    sum_kwh: sum,
    interval_energy_kwh: profile,
  };
  await writeFile(outPath, `${JSON.stringify(payload)}\n`, "utf8");

  const rel = path.relative(REPO, outPath);
  console.log(`Wrote ${rel}`);
  console.log(
    `  length=${profile.length} sum=${sum.toFixed(6)} kWh peak_interval=${Math.max(...profile).toExponential(4)} kWh`
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
