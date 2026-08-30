#!/usr/bin/env node
/**
 * Pack the 27 WPuQ 2019 COMPLETE NO_PV household shapes into a compact
 * production asset. Does not modify research files.
 *
 * Run from repo root:
 *   node apps/speicher-physik/scripts/packWpuqCohort.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..", "..");
const srcDir = path.join(
  root,
  "research/wpuq/processed/profiles_2019_normalized"
);
const cohortPath = path.join(
  root,
  "research/wpuq/processed/benchmark_cohort_2019.json"
);
const outDir = path.join(root, "apps/speicher-physik/data/wpuq");

const cohort = JSON.parse(fs.readFileSync(cohortPath, "utf8"));
const houseIds = cohort.house_ids;
if (houseIds.length !== 27) {
  throw new Error(`expected 27 houses, got ${houseIds.length}`);
}

const STEPS = 35040;
const buffers = [];
for (const id of houseIds) {
  const data = JSON.parse(
    fs.readFileSync(path.join(srcDir, `${id}.json`), "utf8")
  );
  const arr = data.interval_energy_kwh;
  if (!Array.isArray(arr) || arr.length !== STEPS) {
    throw new Error(`${id}: expected ${STEPS} intervals, got ${arr?.length}`);
  }
  const sum = arr.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 5000) > 1e-6) {
    throw new Error(`${id}: packed annual sum ${sum}, expected 5000`);
  }
  const buf = Buffer.allocUnsafe(STEPS * 8);
  for (let i = 0; i < STEPS; i++) buf.writeDoubleLE(arr[i], i * 8);
  buffers.push(buf);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "cohort.f64le"), Buffer.concat(buffers));
fs.writeFileSync(
  path.join(outDir, "cohort.meta.json"),
  JSON.stringify(
    {
      source:
        "WPuQ 2019 NO_PV COMPLETE HOUSEHOLD shapes (packed from research, research files unchanged)",
      year: 2019,
      houseIds,
      steps: STEPS,
      packedAnnualKwh: 5000,
      dtype: "float64le",
      houseCount: houseIds.length,
    },
    null,
    2
  ) + "\n"
);
console.log(`packed ${houseIds.length} houses → ${outDir}`);
