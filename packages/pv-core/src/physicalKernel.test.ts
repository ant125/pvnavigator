import { describe, expect, it } from "vitest";
import {
  BATTERY_MODEL_VERSION,
  calculateEigenverbrauch,
} from "./index";
import {
  DEFAULT_MULTI_YEAR_YEARS,
  DEFAULT_WEATHER_DATABASE,
  PHYSICAL_KERNEL_SCHEMA_VERSION,
  findKernelYear,
  findKernelYearBattery,
  runPhysicalKernel,
} from "./physicalKernel";

const HOURS = 8760;

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

function pvForYear(year: number): number[] {
  const midday = year === 2018 ? 2.0 : 0.5;
  const out = new Array<number>(HOURS);
  for (let h = 0; h < HOURS; h++) {
    const hourOfDay = h % 24;
    out[h] = hourOfDay >= 10 && hourOfDay < 16 ? midday : 0;
  }
  return out;
}

describe("runPhysicalKernel", () => {
  it("still requires 8760 arrays (15-min pipeline is not wired to production)", () => {
    const qh = new Array(35040).fill(0.1);
    expect(() =>
      runPhysicalKernel({
        years: [2018],
        batterySizes: [5],
        getLoadForYear: () => qh,
        getPvForYear: () => qh,
        timeStepHours: 0.25,
      })
    ).toThrow(/35040/);
  });

  it("keeps a full yearly ledger for every weather year × battery size", () => {
    const years = [...DEFAULT_MULTI_YEAR_YEARS];
    const batterySizes = [5, 6];
    const kernel = runPhysicalKernel({
      years,
      batterySizes,
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      createdAt: "2026-08-29T00:00:00.000Z",
    });

    expect(kernel.years).toHaveLength(15);
    expect(kernel.years.map((y) => y.year)).toEqual(years);
    expect(kernel.meta.modelVersion).toBe(BATTERY_MODEL_VERSION);
    expect(kernel.meta.kernelSchemaVersion).toBe(PHYSICAL_KERNEL_SCHEMA_VERSION);
    expect(kernel.meta.weatherDatabase).toBe(DEFAULT_WEATHER_DATABASE);
    expect(kernel.meta.weatherPeriod).toEqual({
      startYear: 2006,
      endYear: 2020,
    });
    expect(kernel.meta.createdAt).toBe("2026-08-29T00:00:00.000Z");
    expect(kernel.meta.includeHourly).toBe(false);
    expect(kernel.meta.hourlyBatterySizes).toEqual([]);

    for (const y of years) {
      const yearRow = findKernelYear(kernel, y);
      expect(yearRow).toBeDefined();
      expect(yearRow!.batteries).toHaveLength(2);
      expect(yearRow!.hourlyPvKwh).toBeUndefined();
      expect(yearRow!.hourlyLoadKwh).toBeUndefined();
      for (const size of batterySizes) {
        const b = findKernelYearBattery(yearRow!, size);
        expect(b).toBeDefined();
        expect(b!.selfConsumptionWithStorageKwh).toBe(kernel.yearly[y][size]);
        expect(b!.hourly).toBeUndefined();
        expect(b!.gridImportKwh).toBeCloseTo(
          b!.gridToHouseholdKwh + b!.gridToAuxiliaryKwh,
          12
        );
        expect(b!.batteryLossesKwh).toBeCloseTo(
          b!.chargeLossKwh + b!.dischargeLossKwh + b!.selfDischargeLossKwh,
          12
        );
      }
    }
  });

  it("averages equal the arithmetic mean of retained yearly results", () => {
    const years = [...DEFAULT_MULTI_YEAR_YEARS];
    const kernel = runPhysicalKernel({
      years,
      batterySizes: [5],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
    });

    const mean = (pick: (year: number) => number) =>
      years.reduce((s, y) => s + pick(y), 0) / years.length;

    expect(kernel.average[5]).toBeCloseTo(
      mean((y) => kernel.yearly[y][5]),
      12
    );
    expect(kernel.averageSelfConsumptionWithoutStorageKwh).toBeCloseTo(
      mean(
        (y) =>
          findKernelYear(kernel, y)!.selfConsumptionWithoutStorageKwh
      ),
      12
    );
    expect(kernel.averagePvYieldKwhAnnual).toBeCloseTo(
      mean((y) => findKernelYear(kernel, y)!.pvYieldKwh),
      12
    );
    expect(kernel.averageLoadKwhAnnual).toBeCloseTo(
      mean((y) => findKernelYear(kernel, y)!.loadKwh),
      12
    );
    expect(kernel.averageBatteryChargedKwh[5]).toBeCloseTo(
      mean(
        (y) =>
          findKernelYearBattery(findKernelYear(kernel, y)!, 5)!
            .batteryChargedKwh
      ),
      12
    );
  });

  it("JSON round-trips without hourly arrays when includeHourly is false", () => {
    const kernel = runPhysicalKernel({
      years: [2016, 2017],
      batterySizes: [5],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      createdAt: "2026-08-29T00:00:00.000Z",
    });
    const parsed = JSON.parse(JSON.stringify(kernel)) as typeof kernel;
    expect(parsed.meta.modelVersion).toBe(BATTERY_MODEL_VERSION);
    expect(parsed.years).toHaveLength(2);
    expect(JSON.stringify(parsed).includes("hourlyPvKwh")).toBe(false);
    expect(JSON.stringify(parsed).includes("hourlyChargeKwh")).toBe(false);
    expect(parsed.years[0].batteries[0].hourly).toBeUndefined();
  });

  it("stores PV and load once per year when includeHourly is true", () => {
    const kernel = runPhysicalKernel({
      years: [2016],
      batterySizes: [5, 6],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      includeHourly: true,
    });
    const yearRow = kernel.years[0];
    expect(yearRow.hourlyPvKwh).toHaveLength(HOURS);
    expect(yearRow.hourlyLoadKwh).toHaveLength(HOURS);
    expect(yearRow.hourlyPvKwh).toEqual(pvForYear(2016));
    expect(calculateEigenverbrauch(yearRow.hourlyLoadKwh!, yearRow.hourlyPvKwh!)).toBe(
      yearRow.selfConsumptionWithoutStorageKwh
    );
    for (const b of yearRow.batteries) {
      expect(b.hourly?.soc).toHaveLength(HOURS);
      expect(b.hourly?.batteryChargeKwh).toHaveLength(HOURS);
      expect(b.hourly?.batteryDischargeKwh).toHaveLength(HOURS);
      expect(b.hourly?.gridImportKwh).toHaveLength(HOURS);
      expect(b.hourly?.gridExportKwh).toHaveLength(HOURS);
    }
    expect(kernel.meta.hourlyBatterySizes).toEqual([5, 6]);
  });

  it("hourlyBatterySizes collects battery hourly only for selected sizes", () => {
    const kernel = runPhysicalKernel({
      years: [2016],
      batterySizes: [5, 6, 7],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      includeHourly: true,
      hourlyBatterySizes: [6],
    });
    const yearRow = kernel.years[0];
    expect(yearRow.hourlyPvKwh).toHaveLength(HOURS);
    expect(findKernelYearBattery(yearRow, 5)!.hourly).toBeUndefined();
    expect(findKernelYearBattery(yearRow, 6)!.hourly?.soc).toHaveLength(HOURS);
    expect(findKernelYearBattery(yearRow, 7)!.hourly).toBeUndefined();
    expect(kernel.meta.hourlyBatterySizes).toEqual([6]);
  });

  it("explicit timeStepHours: 1 matches omitted default aggregates", () => {
    const omitted = runPhysicalKernel({
      years: [2016, 2018],
      batterySizes: [5],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
    });
    const explicit = runPhysicalKernel({
      years: [2016, 2018],
      batterySizes: [5],
      getLoadForYear: loadForYear,
      getPvForYear: pvForYear,
      timeStepHours: 1,
    });
    expect(explicit.average[5]).toBe(omitted.average[5]);
    expect(explicit.averageBatteryChargedKwh[5]).toBe(
      omitted.averageBatteryChargedKwh[5]
    );
    expect(explicit.averageSelfDischargeLossKwh[5]).toBe(
      omitted.averageSelfDischargeLossKwh[5]
    );
    expect(explicit.averageAuxiliaryConsumptionKwh[5]).toBe(
      omitted.averageAuxiliaryConsumptionKwh[5]
    );
    expect(explicit.averageEnergyBalanceErrorKwh[5]).toBe(
      omitted.averageEnergyBalanceErrorKwh[5]
    );
  });
});
