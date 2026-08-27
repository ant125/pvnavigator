import { describe, expect, it } from "vitest";
import {
  BATTERY_MODEL_VERSION,
  calculateEigenverbrauch,
} from "../../../../packages/pv-core";
import {
  DEFAULT_MULTI_YEAR_YEARS,
  simulateMultiYearSpeicherGrenz,
} from "./multiYearSimulation";
import { buildSpeicherChartData } from "./speicherChartData";
import {
  DEFAULT_PLATEAU_DELTA_THRESHOLD_KWH,
  deriveRecommendedTechnicalSize,
} from "./speicherRecommendation";

const HOURS = 8760;

/** Midday-heavy load so PV scale changes no-storage overlap. */
function loadForYear(year: number): number[] {
  void year;
  const out = new Array<number>(HOURS);
  for (let h = 0; h < HOURS; h++) {
    const hourOfDay = h % 24;
    if (hourOfDay >= 10 && hourOfDay < 16) out[h] = 1.0;
    else if (hourOfDay >= 18 || hourOfDay < 6) out[h] = 0.8;
    else out[h] = 0.3;
  }
  return out;
}

/**
 * Daytime PV. Non-2018 under-covers midday load (EV0 lower);
 * 2018 over-covers midday (EV0 higher) so a single-year baseline diverges.
 * Evening load still benefits from storage.
 */
function pvForYear(year: number): number[] {
  const midday = year === 2018 ? 2.0 : 0.5;
  const out = new Array<number>(HOURS);
  for (let h = 0; h < HOURS; h++) {
    const hourOfDay = h % 24;
    out[h] = hourOfDay >= 10 && hourOfDay < 16 ? midday : 0;
  }
  return out;
}

describe("simulateMultiYearSpeicherGrenz battery model version", () => {
  it("returns the canonical BATTERY_MODEL_VERSION without a conflicting literal", async () => {
    const result = await simulateMultiYearSpeicherGrenz({
      years: [2016],
      batterySizes: [5],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      latitude: 0,
      longitude: 0,
    });
    expect(result.batteryModelVersion).toBe(BATTERY_MODEL_VERSION);
    expect(result.batteryModelVersion).toBe("1.0.0");
  });
});

describe("simulateMultiYearSpeicherGrenz no-storage baseline", () => {
  it("averages no-storage KPIs over 2016–2020 from the same arrays as sizes 5–30", async () => {
    const years = [...DEFAULT_MULTI_YEAR_YEARS];
    const result = await simulateMultiYearSpeicherGrenz({
      years,
      batterySizes: [5, 6],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      latitude: 0,
      longitude: 0,
    });

    const expectedEv0ByYear: Record<number, number> = {};
    const expectedPvByYear: Record<number, number> = {};
    const expectedLoadByYear: Record<number, number> = {};
    for (const y of years) {
      const load = loadForYear(y);
      const pv = pvForYear(y);
      expectedEv0ByYear[y] = calculateEigenverbrauch(load, pv);
      expectedPvByYear[y] = pv.reduce((a, b) => a + b, 0);
      expectedLoadByYear[y] = load.reduce((a, b) => a + b, 0);
    }
    const mean = (m: Record<number, number>) =>
      years.reduce((s, y) => s + m[y], 0) / years.length;

    expect(result.averageSelfConsumptionWithoutStorageKwh).toBeCloseTo(
      mean(expectedEv0ByYear),
      6
    );
    expect(result.averagePvYieldKwhAnnual).toBeCloseTo(
      mean(expectedPvByYear),
      6
    );
    expect(result.averageLoadKwhAnnual).toBeCloseTo(
      mean(expectedLoadByYear),
      6
    );

    // 2018-only EV0 must differ from the multi-year mean for this fixture
    expect(expectedEv0ByYear[2018]).not.toBeCloseTo(
      result.averageSelfConsumptionWithoutStorageKwh,
      3
    );

    expect(result.average[5]).toBeGreaterThan(
      result.averageSelfConsumptionWithoutStorageKwh
    );
    expect(result.average[6]).toBeGreaterThanOrEqual(result.average[5]);
  });

  it("chart size 0 uses multi-year EV0; ΔEV(0→5) is same-year-set; 50 kWh rule unchanged", async () => {
    const years = [...DEFAULT_MULTI_YEAR_YEARS];
    const result = await simulateMultiYearSpeicherGrenz({
      years,
      batterySizes: [5, 6],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      latitude: 0,
      longitude: 0,
    });

    const chart = buildSpeicherChartData({
      selfConsumptionWithoutStorage:
        result.averageSelfConsumptionWithoutStorageKwh,
      batterySizes: result.batterySizes,
      average: result.average,
    });

    expect(chart.data[0].size).toBe(0);
    expect(chart.data[0].eigenverbrauch).toBe(
      result.averageSelfConsumptionWithoutStorageKwh
    );
    expect(chart.data[0].eigenverbrauch).not.toBe(
      calculateEigenverbrauch(loadForYear(2018), pvForYear(2018))
    );

    const delta0to5 = chart.data.find((p) => p.size === 5)?.deltaEigenverbrauch;
    expect(delta0to5).toBeCloseTo(
      result.average[5] - result.averageSelfConsumptionWithoutStorageKwh,
      6
    );

    expect(DEFAULT_PLATEAU_DELTA_THRESHOLD_KWH).toBe(50);
    const recommended = deriveRecommendedTechnicalSize({ data: chart.data });
    expect(typeof recommended).toBe("number");
  });

  it("near-threshold case cannot flip solely because 2018 differs from multi-year EV0", () => {
    /**
     * Multi-year: EV0=3000, EV5=3055 → Δ=55 ≥ 50 → does not stop at 0.
     * 2018-only: EV0=3020, EV5=3055 → Δ=35 < 50 → would wrongly recommend 0.
     * Production must use the multi-year baseline.
     */
    const ev0Multi = 3000;
    const fake2018Ev0 = 3020;
    const ev5Mean = 3055;
    const ev6Mean = 3080;

    const chartMulti = buildSpeicherChartData({
      selfConsumptionWithoutStorage: ev0Multi,
      batterySizes: [5, 6],
      average: { 5: ev5Mean, 6: ev6Mean },
    });
    const chartIf2018 = buildSpeicherChartData({
      selfConsumptionWithoutStorage: fake2018Ev0,
      batterySizes: [5, 6],
      average: { 5: ev5Mean, 6: ev6Mean },
    });

    expect(chartMulti.data[1].deltaEigenverbrauch).toBe(55);
    expect(chartIf2018.data[1].deltaEigenverbrauch).toBe(35);

    expect(deriveRecommendedTechnicalSize({ data: chartMulti.data })).not.toBe(
      0
    );
    expect(deriveRecommendedTechnicalSize({ data: chartIf2018.data })).toBe(0);
  });
});
