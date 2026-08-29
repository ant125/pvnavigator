/**
 * Live Phase-4D verification: Köln 15-min production path vs frozen hourly KPIs.
 *
 * Run from repo root:
 *   npx tsx --tsconfig apps/speicher-physik/tsconfig.json apps/speicher-physik/scripts/livePhase4DVerify.ts
 */
import {
  expandAlignedPvgisHourlyToQuarterHours,
  loadPVGISHourlyProfilesByYear,
} from "../../../packages/pvgis-adapter/src/index.ts";
import { createUserLoadProfile15MinForYear } from "../../../packages/bdew-profile/src/index.ts";
import {
  TIME_STEP_HOURS_15,
  runPhysicalKernel,
  DEFAULT_MULTI_YEAR_YEARS,
  DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH,
} from "../../../packages/pv-core/src/index.ts";
import { toPVGISAspect } from "../src/lib/toPVGISAspect.ts";
import { buildSpeicherChartData } from "../src/lib/speicherChartData.ts";
import { deriveRecommendedTechnicalSize } from "../src/lib/speicherRecommendation.ts";

/** Köln city centre. */
const LAT = 50.9375;
const LON = 6.9603;
const KWP = 10;
const TILT = 30;
const UI_AZIMUTH_SOUTH = 180;
const ANNUAL_LOAD = 5000;
const YEARS = [...DEFAULT_MULTI_YEAR_YEARS];
const SIZES = [...DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH];

const OLD = {
  pvYield: 10106,
  speicherGrenze: 9,
  ev0: 2209,
  evWith: 4273,
  netzbezug: 727,
  autarkie: 85,
  evQuote: 42,
};

const HTW = {
  sizeKwh: 10,
  autarkie: 76,
  evQuote: 41,
};

function fmt(n: number, d = 1): string {
  return n.toFixed(d);
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function delta(newVal: number, oldVal: number, digits = 1): string {
  const d = newVal - oldVal;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(digits)}`;
}

async function timed<T>(
  label: string,
  fn: () => Promise<T>
): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  const ms = performance.now() - t0;
  console.log(`${label}: ${ms.toFixed(0)} ms`);
  return { result, ms };
}

async function fetchHourlyPvByYear(
  surfaces: Array<{ systemSizeKwP: number; tiltDeg: number; azimuthDeg: number }>
): Promise<Record<number, number[]>> {
  const startYear = Math.min(...YEARS);
  const endYear = Math.max(...YEARS);
  const perSurface = await Promise.all(
    surfaces.map((s) =>
      loadPVGISHourlyProfilesByYear({
        latitude: LAT,
        longitude: LON,
        systemSizeKwP: s.systemSizeKwP,
        tiltDeg: s.tiltDeg,
        azimuthDeg: toPVGISAspect(s.azimuthDeg),
        startYear,
        endYear,
      })
    )
  );
  const out: Record<number, number[]> = {};
  for (const year of YEARS) {
    const n = perSurface[0][year].length;
    const summed = new Array<number>(n).fill(0);
    for (const byYear of perSurface) {
      const p = byYear[year];
      for (let i = 0; i < n; i++) summed[i] += p[i];
    }
    out[year] = summed;
  }
  return out;
}

function kpisFromKernel(
  kernel: ReturnType<typeof runPhysicalKernel>,
  size: number
) {
  const ev0 = kernel.averageSelfConsumptionWithoutStorageKwh;
  const ev = kernel.average[size];
  const load = kernel.averageLoadKwhAnnual;
  const pv = kernel.averagePvYieldKwhAnnual;
  const autarkie = load > 0 ? (ev / load) * 100 : 0;
  const evQuote = pv > 0 ? (ev / pv) * 100 : 0;
  return {
    pvYield: pv,
    load,
    ev0,
    evWith: ev,
    netzbezug: kernel.averageGridToHouseholdKwh[size],
    exportKwh: kernel.averageGridExportKwh[size],
    charge: kernel.averageBatteryChargedKwh[size],
    discharge: kernel.averageBatteryDischargedKwh[size],
    losses:
      kernel.averageChargeLossKwh[size] +
      kernel.averageDischargeLossKwh[size] +
      kernel.averageSelfDischargeLossKwh[size],
    autarkie,
    evQuote,
  };
}

async function main(): Promise<void> {
  console.log("=== Phase 4D live Köln (5000 kWh, 10 kWp, Süd, 30°, no WP) ===\n");

  const oneRoof = [{ systemSizeKwP: KWP, tiltDeg: TILT, azimuthDeg: UI_AZIMUTH_SOUTH }];
  const threeRoofs = [
    { systemSizeKwP: 4, tiltDeg: TILT, azimuthDeg: UI_AZIMUTH_SOUTH },
    { systemSizeKwP: 3, tiltDeg: TILT, azimuthDeg: UI_AZIMUTH_SOUTH },
    { systemSizeKwP: 3, tiltDeg: TILT, azimuthDeg: UI_AZIMUTH_SOUTH },
  ];

  const { result: hourlyByYear, ms: pvgis1Ms } = await timed(
    "PVGIS network (1 roof, 2006–2020)",
    () => fetchHourlyPvByYear(oneRoof)
  );

  const loadByYear: Record<number, number[]> = {};
  for (const year of YEARS) {
    loadByYear[year] = createUserLoadProfile15MinForYear(ANNUAL_LOAD, year);
  }
  const pvQhByYear: Record<number, number[]> = {};
  for (const year of YEARS) {
    pvQhByYear[year] = expandAlignedPvgisHourlyToQuarterHours(hourlyByYear[year]);
  }

  const { result: kernel1, ms: phys1Ms } = await timed(
    "local physics 1 roof (15y × 26 sizes × 35040)",
    async () =>
      runPhysicalKernel({
        years: YEARS,
        batterySizes: SIZES,
        getLoadForYear: (y) => loadByYear[y],
        getPvForYear: (y) => pvQhByYear[y],
        timeStepHours: TIME_STEP_HOURS_15,
        includeHourly: false,
      })
  );

  const chart = buildSpeicherChartData({
    selfConsumptionWithoutStorage: kernel1.averageSelfConsumptionWithoutStorageKwh,
    batterySizes: kernel1.batterySizes,
    average: kernel1.average,
  });
  const grenze = deriveRecommendedTechnicalSize({ data: chart.data });
  const atGrenze = kpisFromKernel(kernel1, grenze);
  const at10 = kpisFromKernel(kernel1, HTW.sizeKwh);
  const kernelJson = JSON.stringify(kernel1);

  console.log("\n--- timestep / payload ---");
  console.log(
    `meta: dt=${kernel1.meta.timeStepHours} h, ${kernel1.meta.timeStepMinutes} min, steps=${kernel1.meta.stepsPerYear}`
  );
  console.log(`years: ${kernel1.years.length}, model ${kernel1.batteryModelVersion}, schema ${kernel1.meta.kernelSchemaVersion}`);
  console.log(`compact kernel (includeHourly=${kernel1.meta.includeHourly}) bytes: ${kernelJson.length} (hourlyPvKwh present: ${kernelJson.includes("hourlyPvKwh")})`);

  console.log("\n--- OLD hourly (Phase 3/4C reference) → NEW 15 min ---");
  console.log(`Speichergrenze          ${OLD.speicherGrenze} → ${grenze} kWh  (Δ ${delta(grenze, OLD.speicherGrenze, 0)})`);
  console.log(`PV yield                ${OLD.pvYield} → ${fmt(atGrenze.pvYield)} kWh  (Δ ${delta(atGrenze.pvYield, OLD.pvYield)})`);
  console.log(`EV ohne Speicher        ${OLD.ev0} → ${fmt(atGrenze.ev0)} kWh  (Δ ${delta(atGrenze.ev0, OLD.ev0)})`);
  console.log(`EV mit Speicher         ${OLD.evWith} → ${fmt(atGrenze.evWith)} kWh  (Δ ${delta(atGrenze.evWith, OLD.evWith)})`);
  console.log(`Netzbezug               ${OLD.netzbezug} → ${fmt(atGrenze.netzbezug)} kWh  (Δ ${delta(atGrenze.netzbezug, OLD.netzbezug)})`);
  console.log(`Netzeinspeisung         n/a → ${fmt(atGrenze.exportKwh)} kWh`);
  console.log(`Batterieladung          n/a → ${fmt(atGrenze.charge)} kWh`);
  console.log(`Batterieentladung       n/a → ${fmt(atGrenze.discharge)} kWh`);
  console.log(`Verluste                n/a → ${fmt(atGrenze.losses)} kWh`);
  console.log(`Autarkie                ${OLD.autarkie}% → ${pct(atGrenze.autarkie)}  (Δ ${delta(atGrenze.autarkie, OLD.autarkie)})`);
  console.log(`Eigenverbrauchsquote    ${OLD.evQuote}% → ${pct(atGrenze.evQuote)}  (Δ ${delta(atGrenze.evQuote, OLD.evQuote)})`);

  console.log("\n--- HTW Unabhängigkeitsrechner (10 kWh usable, not fitted) ---");
  console.log(`HTW Autarkie ≈ ${HTW.autarkie}%  | ours @10 kWh ${pct(at10.autarkie)}  gap ${delta(at10.autarkie, HTW.autarkie)} pp`);
  console.log(`HTW EV-Anteil ≈ ${HTW.evQuote}% | ours @10 kWh ${pct(at10.evQuote)}  gap ${delta(at10.evQuote, HTW.evQuote)} pp`);
  console.log(`Old hourly Autarkie at Grenze ~${OLD.autarkie}% vs HTW ${HTW.autarkie}% (gap ~${OLD.autarkie - HTW.autarkie} pp)`);
  console.log(`New 15-min Autarkie at 10 kWh ${pct(at10.autarkie)} vs HTW ${HTW.autarkie}%`);

  const { result: hourly3, ms: pvgis3Ms } = await timed(
    "PVGIS network (3 roofs, 2006–2020)",
    () => fetchHourlyPvByYear(threeRoofs)
  );
  const pv3: Record<number, number[]> = {};
  for (const year of YEARS) {
    pv3[year] = expandAlignedPvgisHourlyToQuarterHours(hourly3[year]);
  }
  const { ms: phys3Ms } = await timed(
    "local physics 3 roofs (same 15y × 26 × 35040 after hourly sum)",
    async () =>
      runPhysicalKernel({
        years: YEARS,
        batterySizes: SIZES,
        getLoadForYear: (y) => loadByYear[y],
        getPvForYear: (y) => pv3[y],
        timeStepHours: TIME_STEP_HOURS_15,
        includeHourly: false,
      })
  );

  const rssMb =
    typeof process.memoryUsage === "function"
      ? process.memoryUsage().rss / (1024 * 1024)
      : NaN;

  console.log("\n--- runtime ---");
  console.log(`1 roof:  PVGIS ${pvgis1Ms.toFixed(0)} ms + physics ${phys1Ms.toFixed(0)} ms = ${(pvgis1Ms + phys1Ms).toFixed(0)} ms`);
  console.log(`3 roofs: PVGIS ${pvgis3Ms.toFixed(0)} ms + physics ${phys3Ms.toFixed(0)} ms = ${(pvgis3Ms + phys3Ms).toFixed(0)} ms`);
  console.log(`RSS after runs: ${fmt(rssMb, 0)} MB`);
  console.log("Vercel: Fluid default timeout 300s; this wall-clock is well below.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
