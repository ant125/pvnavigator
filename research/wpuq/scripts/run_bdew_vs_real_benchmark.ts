/**
 * WPuQ Phase 2 — BDEW H25 vs real 2019 household load shapes.
 *
 * Research/validation only. Does not change production.
 *
 * Run from repo root:
 *   npx tsx --tsconfig apps/speicher-physik/tsconfig.json \
 *     research/wpuq/scripts/run_bdew_vs_real_benchmark.ts
 */

import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createUserLoadProfile15MinForYear } from "../../../packages/bdew-profile/src/index.ts";
import {
  expandAlignedPvgisHourlyToQuarterHours,
  loadPVGISHourlyProfilesByYear,
} from "../../../packages/pvgis-adapter/src/index.ts";
import {
  DEFAULT_BATTERY_SPEC,
  DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH,
  DEFAULT_WEATHER_DATABASE,
  STEPS_PER_NON_LEAP_YEAR_15,
  TIME_STEP_HOURS_15,
  calculateEigenverbrauch,
  runPhysicalKernel,
  type PhysicalKernelResult,
} from "../../../packages/pv-core/src/index.ts";
import { buildSpeicherChartData } from "../../../apps/speicher-physik/src/lib/speicherChartData.ts";
import { deriveRecommendedTechnicalSize } from "../../../apps/speicher-physik/src/lib/speicherRecommendation.ts";
import { toPVGISAspect } from "../../../apps/speicher-physik/src/lib/toPVGISAspect.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROCESSED = path.join(ROOT, "processed");
const RESULTS = path.join(ROOT, "results");

type Phase2Config = {
  annual_load_kwh: number;
  year: number;
  pv: {
    system_size_kwp: number;
    tilt_deg: number;
    ui_azimuth_deg: number;
    location_name: string;
    latitude: number;
    longitude: number;
    pvgis_weather_year: number;
    weather_database: string;
    note: string;
  };
  timestep_hours: number;
  steps_expected: number;
  normalize_tolerance_kwh: number;
  energy_balance_tolerance_kwh: number;
};

type CohortHouse = {
  house_id: string;
  original_measured_kwh: number;
  profile_file: string;
  scale_factor: number;
};

type CohortFile = {
  cohort_size: number;
  house_ids: string[];
  houses: CohortHouse[];
  normalized_annual_kwh: number;
};

type ProfileFile = {
  house_id: string;
  interval_energy_kwh: number[];
  original_measured_kwh: number;
  normalized_sum_kwh: number;
};

type DetailRow = {
  profile_type: "BDEW" | "REAL";
  profile_id: string;
  year: number;
  annual_load_kwh: number;
  original_measured_kwh: number | "";
  battery_kwh: number;
  eigenverbrauch_kwh: number;
  eigenverbrauchsquote_pct: number;
  autarkie_pct: number;
  netzbezug_kwh: number;
  einspeisung_kwh: number;
  battery_charge_kwh: number;
  battery_discharge_kwh: number;
  battery_losses_kwh: number;
  direct_self_consumption_kwh: number;
  technical_speichergrenze_kwh: number;
  pv_yield_kwh: number;
  energy_balance_error_kwh: number;
};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sum(arr: readonly number[]): number {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const w = idx - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

function distStats(values: number[]) {
  const arr = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = arr.length;
  if (n === 0) {
    return {
      count: 0,
      min: null,
      p05: null,
      p25: null,
      median: null,
      mean: null,
      p75: null,
      p95: null,
      max: null,
      std: null,
    };
  }
  const mean = sum(arr) / n;
  const std = Math.sqrt(sum(arr.map((v) => (v - mean) ** 2)) / n);
  return {
    count: n,
    min: arr[0],
    p05: percentile(arr, 5),
    p25: percentile(arr, 25),
    median: percentile(arr, 50),
    mean,
    p75: percentile(arr, 75),
    p95: percentile(arr, 95),
    max: arr[n - 1],
    std,
  };
}

function bdewPercentileRank(realValues: number[], bdewValue: number): number | null {
  if (!realValues.length) return null;
  const sorted = [...realValues].sort((a, b) => a - b);
  let below = 0;
  for (const v of sorted) {
    if (v < bdewValue) below += 1;
  }
  return (100 * below) / sorted.length;
}

function validateSeries(
  label: string,
  series: number[],
  expectedLen: number,
  tolSum: number | null,
  targetSum: number | null,
  allowNegative: boolean
): void {
  assert(
    series.length === expectedLen,
    `${label}: length ${series.length} != ${expectedLen}`
  );
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    assert(Number.isFinite(v), `${label}[${i}] not finite`);
    if (!allowNegative) {
      assert(v >= 0, `${label}[${i}] negative: ${v}`);
    }
  }
  if (tolSum != null && targetSum != null) {
    const s = sum(series);
    assert(
      Math.abs(s - targetSum) <= tolSum,
      `${label}: sum ${s} != ${targetSum} (tol ${tolSum})`
    );
  }
}

type SizeKpis = {
  battery_kwh: number;
  eigenverbrauch_kwh: number;
  eigenverbrauchsquote_pct: number;
  autarkie_pct: number;
  netzbezug_kwh: number;
  einspeisung_kwh: number;
  battery_charge_kwh: number;
  battery_discharge_kwh: number;
  battery_losses_kwh: number;
  direct_self_consumption_kwh: number;
  energy_balance_error_kwh: number;
};

function kpisAtSize(
  kernel: PhysicalKernelResult,
  size: number,
  energyBalanceTol: number
): SizeKpis {
  const load = kernel.averageLoadKwhAnnual;
  const pv = kernel.averagePvYieldKwhAnnual;
  const ev0 = kernel.averageSelfConsumptionWithoutStorageKwh;

  if (size === 0) {
    const ev = ev0;
    return {
      battery_kwh: 0,
      eigenverbrauch_kwh: ev,
      eigenverbrauchsquote_pct: pv > 0 ? (ev / pv) * 100 : 0,
      autarkie_pct: load > 0 ? (ev / load) * 100 : 0,
      netzbezug_kwh: load - ev,
      einspeisung_kwh: pv - ev,
      battery_charge_kwh: 0,
      battery_discharge_kwh: 0,
      battery_losses_kwh: 0,
      direct_self_consumption_kwh: ev,
      energy_balance_error_kwh: 0,
    };
  }

  const ev = kernel.average[size];
  const err = kernel.averageEnergyBalanceErrorKwh[size] ?? 0;
  assert(
    Math.abs(err) <= energyBalanceTol,
    `energy balance error at ${size} kWh: ${err} > ${energyBalanceTol}`
  );

  return {
    battery_kwh: size,
    eigenverbrauch_kwh: ev,
    eigenverbrauchsquote_pct: pv > 0 ? (ev / pv) * 100 : 0,
    autarkie_pct: load > 0 ? (ev / load) * 100 : 0,
    netzbezug_kwh: kernel.averageGridToHouseholdKwh[size],
    einspeisung_kwh: kernel.averageGridExportKwh[size],
    battery_charge_kwh: kernel.averageBatteryChargedKwh[size],
    battery_discharge_kwh: kernel.averageBatteryDischargedKwh[size],
    battery_losses_kwh:
      kernel.averageChargeLossKwh[size] +
      kernel.averageDischargeLossKwh[size] +
      kernel.averageSelfDischargeLossKwh[size],
    direct_self_consumption_kwh: kernel.averageDirectPvToHouseholdKwh[size],
    energy_balance_error_kwh: err,
  };
}

function technicalGrenze(kernel: PhysicalKernelResult): number {
  const chart = buildSpeicherChartData({
    selfConsumptionWithoutStorage: kernel.averageSelfConsumptionWithoutStorageKwh,
    batterySizes: kernel.batterySizes,
    average: kernel.average,
  });
  return deriveRecommendedTechnicalSize({ data: chart.data });
}

function runOneProfile(
  load: number[],
  pv: number[],
  year: number,
  sizes: number[],
  energyBalanceTol: number
): { kernel: PhysicalKernelResult; grenze: number } {
  // Sanity: battery=0 direct SC matches calculateEigenverbrauch
  const evDirect = calculateEigenverbrauch(load, pv);
  const kernel = runPhysicalKernel({
    years: [year],
    batterySizes: sizes,
    getLoadForYear: () => load,
    getPvForYear: () => pv,
    batterySpec: DEFAULT_BATTERY_SPEC,
    timeStepHours: TIME_STEP_HOURS_15,
    includeHourly: false,
    weatherDatabase: DEFAULT_WEATHER_DATABASE,
  });
  assert(
    Math.abs(kernel.averageSelfConsumptionWithoutStorageKwh - evDirect) < 1e-6,
    `battery=0 SC mismatch: kernel=${kernel.averageSelfConsumptionWithoutStorageKwh} direct=${evDirect}`
  );
  assert(kernel.meta.timeStepHours === TIME_STEP_HOURS_15, "dt mismatch");
  assert(
    kernel.meta.stepsPerYear === STEPS_PER_NON_LEAP_YEAR_15,
    "stepsPerYear mismatch"
  );
  const grenze = technicalGrenze(kernel);
  return { kernel, grenze };
}

async function loadJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function csvEscape(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function writeDetailCsv(rows: DetailRow[], filePath: string): Promise<void> {
  const headers = Object.keys(rows[0]) as (keyof DetailRow)[];
  const stream = createWriteStream(filePath, { encoding: "utf8" });
  stream.write(headers.join(",") + "\n");
  for (const row of rows) {
    stream.write(headers.map((h) => csvEscape(row[h] as string | number)).join(",") + "\n");
  }
  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });
}

async function main(): Promise<void> {
  const config = await loadJson<Phase2Config>(path.join(ROOT, "phase2_config.json"));
  const cohort = await loadJson<CohortFile>(
    path.join(PROCESSED, "benchmark_cohort_2019.json")
  );

  assert(config.timestep_hours === TIME_STEP_HOURS_15, "config dt != 0.25");
  assert(config.steps_expected === STEPS_PER_NON_LEAP_YEAR_15, "config steps");
  assert(cohort.cohort_size === cohort.houses.length, "cohort size mismatch");
  assert(cohort.cohort_size > 0, "empty cohort");

  const year = config.year;
  const annual = config.annual_load_kwh;
  const sizes = [...DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH];
  const allSizes = [0, ...sizes];

  console.log("=== WPuQ Phase 2: BDEW vs real 2019 load shapes ===");
  console.log(`Cohort: ${cohort.cohort_size} houses → ${cohort.house_ids.join(", ")}`);
  console.log(
    `Scenario: ${annual} kWh load, ${config.pv.system_size_kwp} kWp, tilt ${config.pv.tilt_deg}°, ` +
      `UI az ${config.pv.ui_azimuth_deg}°, PVGIS year ${config.pv.pvgis_weather_year}, ` +
      `${config.pv.location_name}`
  );

  // --- BDEW reference ---
  const bdewLoad = createUserLoadProfile15MinForYear(annual, year);
  validateSeries(
    "BDEW",
    bdewLoad,
    STEPS_PER_NON_LEAP_YEAR_15,
    config.normalize_tolerance_kwh,
    annual,
    false
  );

  // --- Shared PV (one PVGIS request) ---
  console.log("Fetching shared PVGIS series (once)...");
  const hourlyByYear = await loadPVGISHourlyProfilesByYear({
    latitude: config.pv.latitude,
    longitude: config.pv.longitude,
    systemSizeKwP: config.pv.system_size_kwp,
    tiltDeg: config.pv.tilt_deg,
    azimuthDeg: toPVGISAspect(config.pv.ui_azimuth_deg),
    startYear: config.pv.pvgis_weather_year,
    endYear: config.pv.pvgis_weather_year,
  });
  const hourly = hourlyByYear[config.pv.pvgis_weather_year];
  assert(hourly?.length === 8760, `hourly PV length ${hourly?.length}`);
  const sharedPv = expandAlignedPvgisHourlyToQuarterHours(hourly);
  validateSeries("shared PV", sharedPv, STEPS_PER_NON_LEAP_YEAR_15, null, null, false);
  const pvYield = sum(sharedPv);
  console.log(`Shared PV yield 2019: ${pvYield.toFixed(1)} kWh (steps=${sharedPv.length})`);

  // Freeze PV array identity for all runs
  const getSharedPv = () => sharedPv;

  const detailRows: DetailRow[] = [];
  const profileMeta: Array<{
    profile_type: "BDEW" | "REAL";
    profile_id: string;
    original_measured_kwh: number | null;
    technical_speichergrenze_kwh: number;
    autarkie_0: number;
    autarkie_10: number;
    evq_0: number;
    evq_10: number;
  }> = [];

  function appendProfile(
    profileType: "BDEW" | "REAL",
    profileId: string,
    load: number[],
    originalMeasured: number | null
  ): void {
    const { kernel, grenze } = runOneProfile(
      load,
      getSharedPv(),
      year,
      sizes,
      config.energy_balance_tolerance_kwh
    );
    assert(
      Math.abs(kernel.averagePvYieldKwhAnnual - pvYield) < 1e-6,
      "PV yield drifted — shared PV not reused?"
    );
    assert(
      Math.abs(kernel.averageLoadKwhAnnual - annual) < 1e-4,
      `load annual ${kernel.averageLoadKwhAnnual} != ${annual}`
    );

    for (const size of allSizes) {
      const k = kpisAtSize(kernel, size, config.energy_balance_tolerance_kwh);
      detailRows.push({
        profile_type: profileType,
        profile_id: profileId,
        year,
        annual_load_kwh: annual,
        original_measured_kwh: originalMeasured ?? "",
        battery_kwh: k.battery_kwh,
        eigenverbrauch_kwh: round3(k.eigenverbrauch_kwh),
        eigenverbrauchsquote_pct: round3(k.eigenverbrauchsquote_pct),
        autarkie_pct: round3(k.autarkie_pct),
        netzbezug_kwh: round3(k.netzbezug_kwh),
        einspeisung_kwh: round3(k.einspeisung_kwh),
        battery_charge_kwh: round3(k.battery_charge_kwh),
        battery_discharge_kwh: round3(k.battery_discharge_kwh),
        battery_losses_kwh: round3(k.battery_losses_kwh),
        direct_self_consumption_kwh: round3(k.direct_self_consumption_kwh),
        technical_speichergrenze_kwh: grenze,
        pv_yield_kwh: round3(kernel.averagePvYieldKwhAnnual),
        energy_balance_error_kwh: k.energy_balance_error_kwh,
      });
    }

    const at0 = kpisAtSize(kernel, 0, config.energy_balance_tolerance_kwh);
    const at10 = kpisAtSize(kernel, 10, config.energy_balance_tolerance_kwh);
    profileMeta.push({
      profile_type: profileType,
      profile_id: profileId,
      original_measured_kwh: originalMeasured,
      technical_speichergrenze_kwh: grenze,
      autarkie_0: at0.autarkie_pct,
      autarkie_10: at10.autarkie_pct,
      evq_0: at0.eigenverbrauchsquote_pct,
      evq_10: at10.eigenverbrauchsquote_pct,
    });
    console.log(
      `  ${profileId}: Grenze=${grenze} kWh  Autarkie0=${at0.autarkie_pct.toFixed(1)}%  ` +
        `Autarkie10=${at10.autarkie_pct.toFixed(1)}%`
    );
  }

  console.log("Running BDEW reference...");
  await writeFile(
    path.join(PROCESSED, "bdew_h25_5000_2019.json"),
    JSON.stringify({
      profile_id: "BDEW_H25",
      year,
      annual_kwh: annual,
      interval_count: bdewLoad.length,
      interval_energy_kwh: bdewLoad,
    }) + "\n",
    "utf8"
  );
  appendProfile("BDEW", "BDEW_H25", bdewLoad, null);

  console.log("Running real houses...");
  for (const house of cohort.houses) {
    const profile = await loadJson<ProfileFile>(path.join(ROOT, house.profile_file));
    validateSeries(
      house.house_id,
      profile.interval_energy_kwh,
      STEPS_PER_NON_LEAP_YEAR_15,
      config.normalize_tolerance_kwh,
      annual,
      false
    );
    appendProfile("REAL", house.house_id, profile.interval_energy_kwh, house.original_measured_kwh);
  }

  await mkdir(RESULTS, { recursive: true });
  const detailPath = path.join(RESULTS, "bdew_vs_real_2019_detail.csv");
  await writeDetailCsv(detailRows, detailPath);
  console.log(`Wrote ${detailPath} (${detailRows.length} rows)`);

  // --- Summaries ---
  const bdewMeta = profileMeta.find((p) => p.profile_type === "BDEW")!;
  const realMeta = profileMeta.filter((p) => p.profile_type === "REAL");

  const metricsAtSize = (size: number, key: keyof DetailRow) =>
    detailRows
      .filter((r) => r.profile_type === "REAL" && r.battery_kwh === size)
      .map((r) => Number(r[key]));

  const bdewAt = (size: number) =>
    detailRows.find((r) => r.profile_type === "BDEW" && r.battery_kwh === size)!;

  const perSizeSummary: Record<string, unknown> = {};
  const summaryCsvRows: Array<Record<string, string | number>> = [];

  for (const size of allSizes) {
    const keys = [
      "eigenverbrauch_kwh",
      "eigenverbrauchsquote_pct",
      "autarkie_pct",
      "netzbezug_kwh",
      "einspeisung_kwh",
    ] as const;
    const block: Record<string, unknown> = { battery_kwh: size };
    const bdew = bdewAt(size);
    for (const key of keys) {
      const realVals = metricsAtSize(size, key);
      const stats = distStats(realVals);
      const bdewVal = Number(bdew[key]);
      block[key] = {
        bdew: bdewVal,
        real: stats,
        bdew_percentile_rank_in_real: bdewPercentileRank(realVals, bdewVal),
        bdew_inside_p25_p75:
          stats.p25 != null && stats.p75 != null
            ? bdewVal >= stats.p25 && bdewVal <= stats.p75
            : null,
        bdew_inside_p05_p95:
          stats.p05 != null && stats.p95 != null
            ? bdewVal >= stats.p05 && bdewVal <= stats.p95
            : null,
      };
      summaryCsvRows.push({
        battery_kwh: size,
        metric: key,
        bdew: round3(bdewVal),
        real_count: stats.count,
        real_min: round3(stats.min ?? NaN),
        real_p05: round3(stats.p05 ?? NaN),
        real_p25: round3(stats.p25 ?? NaN),
        real_median: round3(stats.median ?? NaN),
        real_mean: round3(stats.mean ?? NaN),
        real_p75: round3(stats.p75 ?? NaN),
        real_p95: round3(stats.p95 ?? NaN),
        real_max: round3(stats.max ?? NaN),
        real_std: round3(stats.std ?? NaN),
        bdew_percentile_rank: round3(
          bdewPercentileRank(realVals, bdewVal) ?? NaN
        ),
      });
    }
    perSizeSummary[String(size)] = block;
  }

  const grenzeVals = realMeta.map((p) => p.technical_speichergrenze_kwh);
  const grenzeStats = distStats(grenzeVals);
  const grenzeFreq: Record<string, number> = {};
  for (const g of grenzeVals) {
    const k = String(g);
    grenzeFreq[k] = (grenzeFreq[k] ?? 0) + 1;
  }

  // Representative profiles
  const byAutarkie10 = [...realMeta].sort((a, b) => a.autarkie_10 - b.autarkie_10);
  const medianAut = grenzeStats.median; // placeholder unused
  const autarks = realMeta.map((p) => p.autarkie_10).sort((a, b) => a - b);
  const medianAutarkie10 = percentile(autarks, 50);
  const closestMedianAut = [...realMeta].sort(
    (a, b) =>
      Math.abs(a.autarkie_10 - medianAutarkie10) -
      Math.abs(b.autarkie_10 - medianAutarkie10)
  )[0];
  const medianGrenze = grenzeStats.median ?? 0;
  const closestMedianGrenze = [...realMeta].sort(
    (a, b) =>
      Math.abs(a.technical_speichergrenze_kwh - medianGrenze) -
      Math.abs(b.technical_speichergrenze_kwh - medianGrenze)
  )[0];

  const representative = {
    closest_to_median_autarkie_at_10kwh: {
      house_id: closestMedianAut.profile_id,
      autarkie_10_pct: closestMedianAut.autarkie_10,
      cohort_median_autarkie_10_pct: medianAutarkie10,
    },
    lowest_autarkie_at_10kwh: {
      house_id: byAutarkie10[0].profile_id,
      autarkie_10_pct: byAutarkie10[0].autarkie_10,
    },
    highest_autarkie_at_10kwh: {
      house_id: byAutarkie10[byAutarkie10.length - 1].profile_id,
      autarkie_10_pct: byAutarkie10[byAutarkie10.length - 1].autarkie_10,
    },
    closest_to_median_technical_speichergrenze: {
      house_id: closestMedianGrenze.profile_id,
      technical_speichergrenze_kwh: closestMedianGrenze.technical_speichergrenze_kwh,
      cohort_median_kwh: medianGrenze,
    },
    outliers_notes: buildOutlierNotes(realMeta, bdewMeta),
  };

  void medianAut;

  const summary = {
    phase: 2,
    purpose:
      "Isolate household LOAD SHAPE effect on physical KPIs vs BDEW H25 within WPuQ 2019 NO_PV COMPLETE cohort",
    scenario: {
      annual_load_kwh: annual,
      pv: config.pv,
      timestep_hours: TIME_STEP_HOURS_15,
      battery_sizes_kwh: allSizes,
      battery_spec_version_note: "DEFAULT_BATTERY_SPEC from @pv-core",
      weather_database: config.pv.weather_database || DEFAULT_WEATHER_DATABASE,
      shared_pv_yield_kwh: round3(pvYield),
    },
    cohort: {
      size: cohort.cohort_size,
      house_ids: cohort.house_ids,
    },
    bdew: {
      technical_speichergrenze_kwh: bdewMeta.technical_speichergrenze_kwh,
      no_battery: {
        eigenverbrauchsquote_pct: bdewMeta.evq_0,
        autarkie_pct: bdewMeta.autarkie_0,
      },
      at_10_kwh: {
        eigenverbrauchsquote_pct: bdewMeta.evq_10,
        autarkie_pct: bdewMeta.autarkie_10,
      },
    },
    real_technical_speichergrenze: {
      ...grenzeStats,
      frequency_by_size_kwh: grenzeFreq,
      bdew_value: bdewMeta.technical_speichergrenze_kwh,
      bdew_percentile_rank_in_real: bdewPercentileRank(
        grenzeVals,
        bdewMeta.technical_speichergrenze_kwh
      ),
      bdew_inside_p25_p75:
        grenzeStats.p25 != null && grenzeStats.p75 != null
          ? bdewMeta.technical_speichergrenze_kwh >= grenzeStats.p25 &&
            bdewMeta.technical_speichergrenze_kwh <= grenzeStats.p75
          : null,
      bdew_inside_p05_p95:
        grenzeStats.p05 != null && grenzeStats.p95 != null
          ? bdewMeta.technical_speichergrenze_kwh >= grenzeStats.p05 &&
            bdewMeta.technical_speichergrenze_kwh <= grenzeStats.p95
          : null,
    },
    per_battery_size: perSizeSummary,
    representative_preview: representative,
  };

  await writeFile(
    path.join(RESULTS, "bdew_vs_real_2019_summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
    "utf8"
  );

  // summary CSV
  {
    const headers = Object.keys(summaryCsvRows[0]);
    const lines = [
      headers.join(","),
      ...summaryCsvRows.map((r) =>
        headers.map((h) => csvEscape(r[h] as string | number)).join(",")
      ),
    ];
    await writeFile(
      path.join(RESULTS, "bdew_vs_real_2019_summary.csv"),
      lines.join("\n") + "\n",
      "utf8"
    );
  }

  await writeFile(
    path.join(RESULTS, "representative_profiles.json"),
    JSON.stringify(
      {
        ...representative,
        bdew_reference: {
          profile_id: "BDEW_H25",
          technical_speichergrenze_kwh: bdewMeta.technical_speichergrenze_kwh,
          autarkie_0_pct: bdewMeta.autarkie_0,
          autarkie_10_pct: bdewMeta.autarkie_10,
          eigenverbrauchsquote_0_pct: bdewMeta.evq_0,
          eigenverbrauchsquote_10_pct: bdewMeta.evq_10,
        },
        selection_metric: "autarkie_pct at battery=10 kWh unless noted",
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  // Cache shared PV for plots / reproducibility
  await writeFile(
    path.join(PROCESSED, "shared_pv_2019_meta.json"),
    JSON.stringify(
      {
        ...config.pv,
        steps: sharedPv.length,
        annual_yield_kwh: pvYield,
        pvgis_aspect_deg: toPVGISAspect(config.pv.ui_azimuth_deg),
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log("\n=== Key results ===");
  console.log(
    `BDEW: Grenze=${bdewMeta.technical_speichergrenze_kwh}  Aut0=${bdewMeta.autarkie_0.toFixed(1)}%  Aut10=${bdewMeta.autarkie_10.toFixed(1)}%  EVQ0=${bdewMeta.evq_0.toFixed(1)}%  EVQ10=${bdewMeta.evq_10.toFixed(1)}%`
  );
  const a0 = distStats(realMeta.map((p) => p.autarkie_0));
  const a10 = distStats(realMeta.map((p) => p.autarkie_10));
  console.log(
    `REAL Autarkie0: median=${a0.median?.toFixed(1)} P25–P75=${a0.p25?.toFixed(1)}–${a0.p75?.toFixed(1)}`
  );
  console.log(
    `REAL Autarkie10: median=${a10.median?.toFixed(1)} P25–P75=${a10.p25?.toFixed(1)}–${a10.p75?.toFixed(1)}`
  );
  console.log(
    `REAL Grenze: median=${grenzeStats.median} P25–P75=${grenzeStats.p25}–${grenzeStats.p75} freq=${JSON.stringify(grenzeFreq)}`
  );
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function buildOutlierNotes(
  real: Array<{ profile_id: string; autarkie_10: number; technical_speichergrenze_kwh: number }>,
  bdew: { autarkie_10: number; technical_speichergrenze_kwh: number }
) {
  const aut = real.map((p) => p.autarkie_10).sort((a, b) => a - b);
  const med = percentile(aut, 50);
  const p05 = percentile(aut, 5);
  const p95 = percentile(aut, 95);
  const outliers = real.filter((p) => p.autarkie_10 < p05 || p.autarkie_10 > p95);
  return {
    autarkie_10_p05: p05,
    autarkie_10_median: med,
    autarkie_10_p95: p95,
    houses_outside_p05_p95_autarkie_10: outliers.map((o) => ({
      house_id: o.profile_id,
      autarkie_10_pct: o.autarkie_10,
    })),
    bdew_autarkie_10_vs_median_delta_pp: bdew.autarkie_10 - med,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
