#!/usr/bin/env node
/**
 * Pack the 24 WPuQ Wasser/Wasser robustness weight series into a compact
 * production asset. Does not regenerate or modify research JSON.
 *
 * Run from repo root:
 *   node apps/speicher-physik/scripts/packWwRobustnessCohort.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..", "..");
const srcDir = path.join(root, "research/wpuq/processed/robustness");
const indexPath = path.join(srcDir, "index.json");
const outDir = path.join(root, "apps/speicher-physik/data/wpuq");

const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const houses = index.houses;
if (!Array.isArray(houses) || houses.length !== 24) {
  throw new Error(`expected 24 WW robustness houses, got ${houses?.length}`);
}
if (index.averaged || index.clustered || index.synthetic) {
  throw new Error("WW robustness index must be independent measured houses");
}

const STEPS = 35040;
const WEIGHT_SUM_TOL = 1e-9;
const buffers = [];
const houseIds = [];
const profileIds = [];

for (const row of houses) {
  const profileId = row.profileId;
  const houseId = row.houseId;
  const envelope = JSON.parse(
    fs.readFileSync(path.join(srcDir, `${profileId}.json`), "utf8")
  );
  if (envelope.profileId !== profileId) {
    throw new Error(`${profileId}: envelope profileId mismatch`);
  }
  if (envelope.sourceBuilding !== houseId) {
    throw new Error(
      `${profileId}: sourceBuilding ${envelope.sourceBuilding} ≠ ${houseId}`
    );
  }
  if (envelope.technology !== "wasserwasser") {
    throw new Error(`${profileId}: expected wasserwasser`);
  }
  if (envelope.dhwService !== "space_heat_and_dhw") {
    throw new Error(`${profileId}: expected space_heat_and_dhw`);
  }
  if (envelope.steps !== STEPS) {
    throw new Error(`${profileId}: steps ${envelope.steps}, expected ${STEPS}`);
  }
  const weights = envelope.weights;
  if (!Array.isArray(weights) || weights.length !== STEPS) {
    throw new Error(
      `${profileId}: expected ${STEPS} weights, got ${weights?.length}`
    );
  }
  let sum = 0;
  for (let i = 0; i < STEPS; i++) {
    const w = weights[i];
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`${profileId}: invalid weight at ${i}`);
    }
    sum += w;
  }
  if (Math.abs(sum - 1) > WEIGHT_SUM_TOL) {
    throw new Error(`${profileId}: weight sum ${sum}, expected ~1`);
  }

  const buf = Buffer.allocUnsafe(STEPS * 8);
  for (let i = 0; i < STEPS; i++) buf.writeDoubleLE(weights[i], i * 8);
  buffers.push(buf);
  houseIds.push(houseId);
  profileIds.push(profileId);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "ww-robustness.f64le"), Buffer.concat(buffers));
fs.writeFileSync(
  path.join(outDir, "ww-robustness.meta.json"),
  JSON.stringify(
    {
      source:
        "WPuQ 2019 Wasser/Wasser measured robustness weights (packed from research/wpuq/processed/robustness, research files unchanged)",
      year: 2019,
      technology: "wasserwasser",
      dhwService: "space_heat_and_dhw",
      houseIds,
      profileIds,
      steps: STEPS,
      packedAs: "unit_weights",
      dtype: "float64le",
      houseCount: houseIds.length,
      averaged: false,
      clustered: false,
      independentMeasuredHouses: true,
    },
    null,
    2
  ) + "\n"
);
console.log(`packed ${houseIds.length} WW robustness profiles → ${outDir}`);
