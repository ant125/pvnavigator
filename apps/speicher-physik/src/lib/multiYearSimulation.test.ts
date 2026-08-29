import { describe, expect, it } from "vitest";
import {
  BATTERY_MODEL_VERSION,
  calculateEigenverbrauch,
} from "../../../../packages/pv-core";
import {
  DEFAULT_MULTI_YEAR_END,
  DEFAULT_MULTI_YEAR_START,
  DEFAULT_MULTI_YEAR_YEARS,
  simulateMultiYearSpeicherGrenz,
} from "./multiYearSimulation";
import { buildSpeicherChartData } from "./speicherChartData";
import {
  DEFAULT_PLATEAU_DELTA_THRESHOLD_KWH,
  deriveRecommendedTechnicalSize,
} from "./speicherRecommendation";
import { toSpeicherGrenzPayload } from "./calculateSpeicherResult";

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

describe("DEFAULT_MULTI_YEAR_YEARS", () => {
  it("is exactly 2006–2020 (15 years)", () => {
    expect(DEFAULT_MULTI_YEAR_START).toBe(2006);
    expect(DEFAULT_MULTI_YEAR_END).toBe(2020);
    expect(DEFAULT_MULTI_YEAR_YEARS).toHaveLength(15);
    expect(DEFAULT_MULTI_YEAR_YEARS[0]).toBe(2006);
    expect(DEFAULT_MULTI_YEAR_YEARS[DEFAULT_MULTI_YEAR_YEARS.length - 1]).toBe(
      2020
    );
    expect([...DEFAULT_MULTI_YEAR_YEARS]).toEqual(
      Array.from({ length: 15 }, (_, i) => 2006 + i)
    );
  });
});

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
    expect(result.batteryModelVersion).toBe("1.1.0");
  });
});

describe("simulateMultiYearSpeicherGrenz no-storage baseline", () => {
  it("averages no-storage KPIs over 2006–2020 from the same arrays as sizes 5–30", async () => {
    const years = [...DEFAULT_MULTI_YEAR_YEARS];
    expect(years).toHaveLength(15);

    const result = await simulateMultiYearSpeicherGrenz({
      years,
      batterySizes: [5, 6],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      latitude: 0,
      longitude: 0,
    });

    expect(Object.keys(result.yearly).map(Number).sort()).toEqual(years);
    for (const y of years) {
      expect(result.yearly[y][5]).toBeGreaterThan(0);
    }

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

    // Denominator must be 15, not 5: mean of all years ≠ mean of 2016–2020 only
    const years5 = [2016, 2017, 2018, 2019, 2020];
    const mean5 =
      years5.reduce((s, y) => s + expectedEv0ByYear[y], 0) / years5.length;
    expect(result.averageSelfConsumptionWithoutStorageKwh).not.toBeCloseTo(
      mean5,
      3
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

  it("SpeicherGrenze uses aggregate mean curve, not mean of yearly Grenzen", async () => {
    /**
     * Construct year-dependent EV so that:
     * - yearly SpeicherGrenze would be 5 for "high" years and 6 for "low" years
     * - mean of yearly Grenzen ≠ Grenze on the mean curve
     *
     * Plateau: first ΔEV < 50 stops; return previous size.
     * At size 5: high years have large Δ from 0; low years plateau earlier.
     */
    const years = [...DEFAULT_MULTI_YEAR_YEARS];
    // Alternate: odd years → EV jumps big at 5 then tiny at 6 (Grenze=5)
    //            even years → EV jumps big at 5 and 6 then tiny (Grenze=6)
    function evForYearSize(year: number, size: number): number {
      const base = 3000;
      if (size === 0) return base;
      if (year % 2 === 1) {
        // Grenze = 5: Δ(0→5)=80, Δ(5→6)=10
        if (size === 5) return base + 80;
        return base + 80 + 10 + (size - 6) * 5;
      }
      // Grenze = 6: Δ(0→5)=80, Δ(5→6)=60, Δ(6→7)=10
      if (size === 5) return base + 80;
      if (size === 6) return base + 80 + 60;
      return base + 80 + 60 + 10 + (size - 7) * 5;
    }

    // Inject via getPv/getLoad is heavy; instead verify aggregation semantics
    // on synthetic yearly maps matching simulateMultiYearSpeicherGrenz output shape.
    const batterySizes = [5, 6, 7];
    const yearly: Record<number, Record<number, number>> = {};
    for (const y of years) {
      yearly[y] = {};
      for (const s of batterySizes) {
        yearly[y][s] = evForYearSize(y, s);
      }
    }

    const average: Record<number, number> = {};
    for (const s of batterySizes) {
      average[s] =
        years.reduce((sum, y) => sum + yearly[y][s], 0) / years.length;
    }
    const ev0 = 3000;

    const chartFromAggregate = buildSpeicherChartData({
      selfConsumptionWithoutStorage: ev0,
      batterySizes,
      average,
    });
    const grenzeFromAggregate = deriveRecommendedTechnicalSize({
      data: chartFromAggregate.data,
    });

    const yearlyGrenzen = years.map((y) => {
      const chartY = buildSpeicherChartData({
        selfConsumptionWithoutStorage: ev0,
        batterySizes,
        average: yearly[y],
      });
      return deriveRecommendedTechnicalSize({ data: chartY.data });
    });
    const meanYearlyGrenze =
      yearlyGrenzen.reduce((a, b) => a + b, 0) / yearlyGrenzen.length;

    // Odd years → 5, even → 6; 2006–2020 has 7 odd + 8 even → mean ≠ integer Grenze
    expect(new Set(yearlyGrenzen)).toEqual(new Set([5, 6]));
    expect(meanYearlyGrenze).not.toBe(grenzeFromAggregate);
    // Aggregate curve: Δ(0→5)=80, Δ(5→6)= (7*10+8*60)/15 ≈ 36.67 < 50 → Grenze=5
    expect(grenzeFromAggregate).toBe(5);
    expect(meanYearlyGrenze).toBeCloseTo((7 * 5 + 8 * 6) / 15, 6);
  });
});

describe("PhysicalKernelResult yearly retention and compact payload", () => {
  it("retains full yearly ledgers while averages stay the Phase-2 mean", async () => {
    const years = [...DEFAULT_MULTI_YEAR_YEARS];
    const result = await simulateMultiYearSpeicherGrenz({
      years,
      batterySizes: [5, 6],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      latitude: 0,
      longitude: 0,
      createdAt: "2026-08-29T00:00:00.000Z",
    });

    expect(result.years).toHaveLength(15);
    expect(result.meta.includeHourly).toBe(false);
    expect(result.meta.weatherDatabase).toBe("injected");
    for (const y of years) {
      const yearRow = result.years.find((row) => row.year === y);
      expect(yearRow?.batteries.map((b) => b.usableCapacityKwh)).toEqual([5, 6]);
      expect(yearRow?.hourlyPvKwh).toBeUndefined();
    }
  });

  it("toSpeicherGrenzPayload omits years, hourly series, and kernel meta", async () => {
    const kernel = await simulateMultiYearSpeicherGrenz({
      years: [2016, 2017],
      batterySizes: [5],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      latitude: 0,
      longitude: 0,
      includeHourly: true,
      hourlyBatterySizes: [5],
    });
    expect(kernel.years[0].hourlyPvKwh).toHaveLength(HOURS);
    expect(kernel.years[0].batteries[0].hourly?.soc).toHaveLength(HOURS);

    const payload = toSpeicherGrenzPayload(kernel);
    const json = JSON.stringify(payload);
    expect(payload.average[5]).toBe(kernel.average[5]);
    expect(payload.batteryModelVersion).toBe(BATTERY_MODEL_VERSION);
    expect("years" in payload).toBe(false);
    expect("yearly" in payload).toBe(false);
    expect("meta" in payload).toBe(false);
    expect(json.includes("hourlyPvKwh")).toBe(false);
    expect(json.includes('"hourly"')).toBe(false);
  });
});
