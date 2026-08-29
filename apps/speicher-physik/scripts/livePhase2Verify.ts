/**
 * Live Phase-2 verification: PVGIS 2006–2020 range + KPI comparison vs 2016–2020.
 * Run from repo root:
 *   npx tsx --tsconfig apps/speicher-physik/tsconfig.json apps/speicher-physik/scripts/livePhase2Verify.ts
 */
import { loadPVGISHourlyProfilesByYear } from "../../../packages/pvgis-adapter/src/index.ts";
import { createUserLoadProfileForYear } from "../../../packages/bdew-profile/src/index.ts";
import {
  calculateBatterySimulation,
  calculateEigenverbrauch,
  DEFAULT_BATTERY_SPEC,
} from "../../../packages/pv-core/src/index.ts";

const LAT = 52.52;
const LON = 13.405;
const KWP = 8;
const TILT = 35;
const ASPECT = 0; // south (PVGIS)
const ANNUAL_LOAD = 4500;
const BATTERY_SIZES = Array.from({ length: 26 }, (_, i) => i + 5);
const PLATEAU = 50;

const YEARS_NEW = Array.from({ length: 15 }, (_, i) => 2006 + i);
const YEARS_OLD = [2016, 2017, 2018, 2019, 2020];

function fmt(n: number): string {
  return n.toFixed(1);
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function deriveGrenze(
  ev0: number,
  averageBySize: Record<number, number>,
  sizes: number[]
): number {
  let prev = 0;
  let prevEv = ev0;
  for (const size of sizes) {
    const ev = averageBySize[size];
    const delta = ev - prevEv;
    if (delta < PLATEAU) return prev;
    prev = size;
    prevEv = ev;
  }
  return sizes[sizes.length - 1] ?? 0;
}

type SimAgg = {
  averagePvYield: number;
  averageLoad: number;
  averageEv0: number;
  averageEvBySize: Record<number, number>;
};

function simulateYears(
  years: number[],
  pvByYear: Record<number, number[]>
): SimAgg {
  const pvYields: number[] = [];
  const loads: number[] = [];
  const ev0s: number[] = [];
  const evBySizeYear: Record<number, number[]> = {};
  for (const size of BATTERY_SIZES) evBySizeYear[size] = [];

  for (const year of years) {
    const pv = pvByYear[year];
    if (!pv || pv.length !== 8760) {
      throw new Error(`Missing/invalid PV for ${year}`);
    }
    const load = createUserLoadProfileForYear(ANNUAL_LOAD, year);
    pvYields.push(pv.reduce((a, b) => a + b, 0));
    loads.push(load.reduce((a, b) => a + b, 0));
    ev0s.push(calculateEigenverbrauch(load, pv));
    for (const size of BATTERY_SIZES) {
      const r = calculateBatterySimulation(
        load,
        pv,
        size,
        DEFAULT_BATTERY_SPEC,
        0
      );
      evBySizeYear[size].push(r.selfConsumptionWithStorage);
    }
  }

  const averageEvBySize: Record<number, number> = {};
  for (const size of BATTERY_SIZES) {
    averageEvBySize[size] = mean(evBySizeYear[size]);
  }

  return {
    averagePvYield: mean(pvYields),
    averageLoad: mean(loads),
    averageEv0: mean(ev0s),
    averageEvBySize,
  };
}

function kpis(sim: SimAgg) {
  const grenze = deriveGrenze(sim.averageEv0, sim.averageEvBySize, BATTERY_SIZES);
  const ev =
    grenze === 0 ? sim.averageEv0 : sim.averageEvBySize[grenze];
  const autarkie = sim.averageLoad > 0 ? (ev / sim.averageLoad) * 100 : 0;
  return {
    pvYield: sim.averagePvYield,
    ev0: sim.averageEv0,
    eigenverbrauch: ev,
    autarkie,
    speicherGrenze: grenze,
  };
}

async function timed<T>(
  label: string,
  fn: () => Promise<T>
): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  const ms = performance.now() - t0;
  console.log(`  ${label}: ${ms.toFixed(0)} ms`);
  return { result, ms };
}

async function main() {
  console.log("=== Phase 2 live PVGIS verification ===\n");
  console.log(`Default years: ${YEARS_NEW[0]}–${YEARS_NEW.at(-1)} (${YEARS_NEW.length})`);

  console.log("\n--- A. 1 surface: loadPVGISHourlyProfilesByYear(2006–2020) ---");
  const { result: byYear, ms: pvgisMs } = await timed("PVGIS fetch+align", () =>
    loadPVGISHourlyProfilesByYear({
      latitude: LAT,
      longitude: LON,
      systemSizeKwP: KWP,
      tiltDeg: TILT,
      azimuthDeg: ASPECT,
      startYear: 2006,
      endYear: 2020,
    })
  );

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => a - b);
  console.log(`  years returned: ${years.length} → [${years[0]}…${years.at(-1)}]`);
  console.log(`  request count: 1`);
  let all8760 = true;
  for (const y of years) {
    if (byYear[y].length !== 8760) {
      all8760 = false;
      console.log(`  FAIL year ${y} length ${byYear[y].length}`);
    }
  }
  console.log(`  every year 8760: ${all8760}`);
  console.log(`  URL params: startyear=2006 endyear=2020 raddatabase=PVGIS-SARAH2 api=v5_2`);
  if (years.length !== 15 || years[0] !== 2006 || years.at(-1) !== 2020) {
    throw new Error(`Unexpected year set: ${years.join(",")}`);
  }

  console.log("\n--- B. 3 surfaces: 3 range requests ---");
  const surfaces = [
    { kwp: 4, tilt: 35, aspect: -45 },
    { kwp: 3, tilt: 30, aspect: 0 },
    { kwp: 2, tilt: 40, aspect: 45 },
  ];
  const t3 = performance.now();
  const multi = await Promise.all(
    surfaces.map((s) =>
      loadPVGISHourlyProfilesByYear({
        latitude: LAT,
        longitude: LON,
        systemSizeKwP: s.kwp,
        tiltDeg: s.tilt,
        azimuthDeg: s.aspect,
        startYear: 2006,
        endYear: 2020,
      })
    )
  );
  const multiMs = performance.now() - t3;
  console.log(`  3 parallel range requests: ${multiMs.toFixed(0)} ms`);
  console.log(`  request count: 3`);
  for (let i = 0; i < multi.length; i++) {
    const ys = Object.keys(multi[i]).map(Number).sort((a, b) => a - b);
    console.log(
      `  surface ${i}: ${ys.length} years, first profile len=${multi[i][ys[0]].length}`
    );
  }

  console.log("\n--- C. KPI comparison (same live PV, different year sets) ---");
  const tSim = performance.now();
  const oldSim = simulateYears(YEARS_OLD, byYear);
  const newSim = simulateYears(YEARS_NEW, byYear);
  console.log(`  dual simulation: ${(performance.now() - tSim).toFixed(0)} ms`);

  const oldK = kpis(oldSim);
  const newK = kpis(newSim);

  console.log("\n  OLD 2016–2020:");
  console.log(`    PV yield:        ${fmt(oldK.pvYield)} kWh`);
  console.log(`    EV0:             ${fmt(oldK.ev0)} kWh`);
  console.log(`    EV @ Grenze:     ${fmt(oldK.eigenverbrauch)} kWh`);
  console.log(`    Autarkie:        ${fmt(oldK.autarkie)} %`);
  console.log(`    SpeicherGrenze:  ${oldK.speicherGrenze} kWh`);

  console.log("\n  NEW 2006–2020:");
  console.log(`    PV yield:        ${fmt(newK.pvYield)} kWh`);
  console.log(`    EV0:             ${fmt(newK.ev0)} kWh`);
  console.log(`    EV @ Grenze:     ${fmt(newK.eigenverbrauch)} kWh`);
  console.log(`    Autarkie:        ${fmt(newK.autarkie)} %`);
  console.log(`    SpeicherGrenze:  ${newK.speicherGrenze} kWh`);

  console.log("\n  DELTA (new − old):");
  console.log(`    PV yield:        ${fmt(newK.pvYield - oldK.pvYield)} kWh`);
  console.log(
    `    EV @ Grenze:     ${fmt(newK.eigenverbrauch - oldK.eigenverbrauch)} kWh`
  );
  console.log(`    Autarkie:        ${fmt(newK.autarkie - oldK.autarkie)} pp`);
  console.log(
    `    SpeicherGrenze:  ${newK.speicherGrenze - oldK.speicherGrenze} kWh`
  );

  console.log("\n=== SUMMARY JSON ===");
  console.log(
    JSON.stringify(
      {
        pvgis1SurfaceMs: Math.round(pvgisMs),
        pvgis3SurfaceMs: Math.round(multiMs),
        yearsReturned: years.length,
        timeoutCapMs: 30_000,
        old: oldK,
        new: newK,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("LIVE VERIFY FAILED:", err);
  process.exit(1);
});
