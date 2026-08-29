import { describe, expect, it } from "vitest";
import {
  calculateBatterySimulation,
  DEFAULT_BATTERY_SPEC,
  BATTERY_MODEL_VERSION,
} from "./battery";
import { resolveHybridBatteryPowerLimitKw } from "./batteryPowerLimit";

const HOURS_PER_YEAR = 8760;

/** Absolute energy-balance residual must stay at floating-point noise for 8760 steps. */
const ENERGY_BALANCE_TOL_KWH = 1e-9;

function constantProfile(value: number): number[] {
  return Array.from({ length: HOURS_PER_YEAR }, () => value);
}

function hourlyProfile(build: (h: number) => number): number[] {
  return Array.from({ length: HOURS_PER_YEAR }, (_, h) => build(h));
}

describe("DEFAULT_BATTERY_SPEC.depthOfDischarge", () => {
  it("defaults to 1.0 for market-usable capacity envelope", () => {
    expect(DEFAULT_BATTERY_SPEC.depthOfDischarge).toBe(1.0);
  });
});

describe("frozen DEFAULT_BATTERY_SPEC production model 1.0.0", () => {
  it("locks hybrid efficiencies, self-discharge, standby and DoD", () => {
    expect(DEFAULT_BATTERY_SPEC.efficiencyModel).toBe("hybrid");
    expect(DEFAULT_BATTERY_SPEC.pvToBatteryEfficiency).toBe(0.98);
    expect(DEFAULT_BATTERY_SPEC.batteryChargeEfficiency).toBe(0.99);
    expect(DEFAULT_BATTERY_SPEC.batteryDischargeEfficiency).toBe(0.99);
    expect(DEFAULT_BATTERY_SPEC.batteryToAcEfficiency).toBe(0.98);
    expect(
      DEFAULT_BATTERY_SPEC.pvToBatteryEfficiency! *
        DEFAULT_BATTERY_SPEC.batteryChargeEfficiency! *
        DEFAULT_BATTERY_SPEC.batteryDischargeEfficiency! *
        DEFAULT_BATTERY_SPEC.batteryToAcEfficiency!
    ).toBe(0.94128804);
    expect(DEFAULT_BATTERY_SPEC.selfDischargePerMonth).toBe(0.01);
    expect(DEFAULT_BATTERY_SPEC.auxiliaryPowerW).toBe(15);
    expect(DEFAULT_BATTERY_SPEC.depthOfDischarge).toBe(1.0);
  });

  it("locks the complete hybrid power curve 5–30 kWh", () => {
    expect(resolveHybridBatteryPowerLimitKw(5)).toBe(2.5);
    for (let c = 6; c <= 9; c++) {
      expect(resolveHybridBatteryPowerLimitKw(c)).toBe(3.5);
    }
    for (let c = 10; c <= 15; c++) {
      expect(resolveHybridBatteryPowerLimitKw(c)).toBe(5.0);
    }
    for (let c = 16; c <= 30; c++) {
      expect(resolveHybridBatteryPowerLimitKw(c)).toBe(6.0);
    }
  });
});

describe("BATTERY_MODEL_VERSION", () => {
  it("is the single canonical 1.0.0 literal and is returned by DEFAULT simulations", () => {
    expect(BATTERY_MODEL_VERSION).toBe("1.0.0");
    const result = calculateBatterySimulation(
      constantProfile(0),
      constantProfile(0),
      10,
      DEFAULT_BATTERY_SPEC,
      0
    );
    expect(result.batteryModelVersion).toBe(BATTERY_MODEL_VERSION);
    expect(result.batteryModelVersion).toBe("1.0.0");
  });
});

describe("depthOfDischarge behaviour", () => {
  it("allows full 10 kWh envelope when DoD = 1.0", () => {
    const load = constantProfile(0.1);
    const pv = constantProfile(5);
    const spec = { ...DEFAULT_BATTERY_SPEC, depthOfDischarge: 1.0 };
    const result = calculateBatterySimulation(load, pv, 10, spec, 0);
    expect(Math.max(...result.socHourly)).toBeCloseTo(1.0, 3);
  });

  it("still caps at 90% when explicit depthOfDischarge = 0.9", () => {
    const load = constantProfile(0.1);
    const pv = constantProfile(5);
    const spec = { ...DEFAULT_BATTERY_SPEC, depthOfDischarge: 0.9 };
    const result = calculateBatterySimulation(load, pv, 10, spec, 0);
    expect(Math.max(...result.socHourly)).toBeCloseTo(0.9, 3);
  });

  it("applies backupReserveKwh as discharge floor independently of DoD", () => {
    const load = constantProfile(0.1);
    const pv = constantProfile(5);
    const spec = {
      ...DEFAULT_BATTERY_SPEC,
      depthOfDischarge: 1.0,
      selfDischargePerMonth: 0,
    };
    const result = calculateBatterySimulation(load, pv, 10, spec, 2);
    // Without self-discharge, active discharge never crosses the reserve floor.
    expect(Math.min(...result.socHourly)).toBeGreaterThanOrEqual(0.2 - 1e-6);
    expect(Math.max(...result.socHourly)).toBeCloseTo(1.0, 3);
  });
});

describe("backup reserve SoC initialization and energy balance", () => {
  it("1. no reserve: starts at 0 kWh and preserves no-reserve KPIs", () => {
    const load = constantProfile(0.5);
    const pv = constantProfile(0.8);
    const result = calculateBatterySimulation(
      load,
      pv,
      10,
      DEFAULT_BATTERY_SPEC,
      0
    );
    expect(result.socStartKwh).toBe(0);
    expect(result.socStartPct).toBe(0);
    expect(Math.abs(result.energyBalanceErrorKwh)).toBeLessThan(
      ENERGY_BALANCE_TOL_KWH
    );
    // Frozen no-reserve representative KPIs (pre-correction baselines).
    expect(result.selfConsumptionWithStorage).toBe(4380);
    expect(result.totalDischargedKwh).toBe(0);
    expect(result.batteryToHouseholdKwh).toBe(0);
    expect(result.totalChargedKwh).toBeCloseTo(11.547586269713177, 9);
    expect(result.totalSelfDischargeLossKwh).toBeCloseTo(1.2034724276048245, 9);
    expect(result.socEndKwh).toBeCloseTo(9.999995771274104, 9);
  });

  it("explicit timeStepHours: 1 matches omitted default on frozen no-reserve KPIs", () => {
    const load = constantProfile(0.5);
    const pv = constantProfile(0.8);
    const omitted = calculateBatterySimulation(
      load,
      pv,
      10,
      DEFAULT_BATTERY_SPEC,
      0
    );
    const explicit = calculateBatterySimulation(
      load,
      pv,
      10,
      DEFAULT_BATTERY_SPEC,
      0,
      { timeStepHours: 1 }
    );
    expect(explicit.selfConsumptionWithStorage).toBe(
      omitted.selfConsumptionWithStorage
    );
    expect(explicit.totalChargedKwh).toBe(omitted.totalChargedKwh);
    expect(explicit.totalDischargedKwh).toBe(omitted.totalDischargedKwh);
    expect(explicit.totalSelfDischargeLossKwh).toBe(
      omitted.totalSelfDischargeLossKwh
    );
    expect(explicit.auxiliaryConsumptionKwh).toBe(
      omitted.auxiliaryConsumptionKwh
    );
    expect(explicit.socEndKwh).toBe(omitted.socEndKwh);
    expect(explicit.energyBalanceErrorKwh).toBe(omitted.energyBalanceErrorKwh);
    expect(explicit.gridExportKwh).toBe(omitted.gridExportKwh);
    expect(explicit.socHourly).toEqual(omitted.socHourly);
  });

  it("2. reserve initialization: starts with configured reserve energy", () => {
    const load = constantProfile(0);
    const pv = constantProfile(0);
    const result = calculateBatterySimulation(
      load,
      pv,
      10,
      { ...DEFAULT_BATTERY_SPEC, selfDischargePerMonth: 0, auxiliaryPowerW: 0 },
      2
    );
    expect(result.socStartKwh).toBe(2);
    expect(result.socStartPct).toBe(20);
  });

  it("3. reserve is unavailable for household discharge", () => {
    const load = constantProfile(1);
    const pv = constantProfile(0);
    const result = calculateBatterySimulation(
      load,
      pv,
      10,
      {
        ...DEFAULT_BATTERY_SPEC,
        selfDischargePerMonth: 0,
        auxiliaryPowerW: 0,
      },
      2
    );
    expect(result.socStartKwh).toBe(2);
    expect(result.batteryToHouseholdKwh).toBe(0);
    expect(result.totalDischargedKwh).toBe(0);
    expect(result.gridToHouseholdKwh).toBe(HOURS_PER_YEAR);
    expect(result.socEndKwh).toBeCloseTo(2, 9);
  });

  it("4. no free clamp energy: self-discharge may decline below reserve without ledger charge", () => {
    const load = constantProfile(0);
    const pv = constantProfile(0);
    const result = calculateBatterySimulation(
      load,
      pv,
      10,
      {
        ...DEFAULT_BATTERY_SPEC,
        auxiliaryPowerW: 0,
        selfDischargePerMonth: 0.01,
      },
      2
    );
    expect(result.socStartKwh).toBe(2);
    expect(result.socEndKwh).toBeLessThan(2);
    expect(result.totalSelfDischargeLossKwh).toBeGreaterThan(0);
    expect(result.totalChargedKwh).toBe(0);
    expect(result.gridToHouseholdKwh).toBe(0);
    expect(result.gridToAuxiliaryKwh).toBe(0);
    expect(result.gridExportKwh).toBe(0);
    expect(result.batteryToHouseholdKwh).toBe(0);
    expect(result.batteryToAuxiliaryKwh).toBe(0);
    expect(Math.abs(result.energyBalanceErrorKwh)).toBeLessThan(
      ENERGY_BALANCE_TOL_KWH
    );
    // End SoC ≈ start − self-discharge loss (no free replenishment).
    expect(result.socEndKwh).toBeCloseTo(
      result.socStartKwh - result.totalSelfDischargeLossKwh,
      9
    );
  });

  it("5. PV may restore usable headroom above the reserve", () => {
    // Hour 0: PV charges above reserve. Hours 1+: evening load, no PV.
    const pv = hourlyProfile((h) => (h === 0 ? 8 : 0));
    const load = hourlyProfile((h) => (h === 0 ? 0 : h < 20 ? 0.2 : 0));
    const result = calculateBatterySimulation(
      load,
      pv,
      10,
      {
        ...DEFAULT_BATTERY_SPEC,
        selfDischargePerMonth: 0,
        auxiliaryPowerW: 0,
      },
      2
    );
    expect(result.socStartKwh).toBe(2);
    expect(Math.max(...result.socHourly)).toBeGreaterThan(0.2 + 1e-6);
    expect(result.batteryToHouseholdKwh).toBeGreaterThan(0);
    // Must not discharge the protected 2 kWh reserve into the household.
    const dischargedFromSocApprox =
      result.batteryToHouseholdKwh /
      (DEFAULT_BATTERY_SPEC.batteryDischargeEfficiency! *
        DEFAULT_BATTERY_SPEC.batteryToAcEfficiency!);
    expect(dischargedFromSocApprox).toBeLessThanOrEqual(
      result.totalChargedKwh *
        DEFAULT_BATTERY_SPEC.pvToBatteryEfficiency! *
        DEFAULT_BATTERY_SPEC.batteryChargeEfficiency! +
        1e-6
    );
    expect(result.socEndKwh).toBeGreaterThanOrEqual(2 - 1e-6);
  });

  it("6. oversized reserve: caps at maxSoc with no discharge headroom", () => {
    const load = constantProfile(1);
    const pv = constantProfile(0);
    const result = calculateBatterySimulation(
      load,
      pv,
      10,
      {
        ...DEFAULT_BATTERY_SPEC,
        depthOfDischarge: 1.0,
        selfDischargePerMonth: 0,
        auxiliaryPowerW: 0,
      },
      15
    );
    expect(result.socStartKwh).toBe(10);
    expect(result.socStartPct).toBe(100);
    expect(result.batteryToHouseholdKwh).toBe(0);
    expect(result.totalDischargedKwh).toBe(0);
    expect(Number.isFinite(result.socEndKwh)).toBe(true);
    expect(result.socEndKwh).toBeGreaterThanOrEqual(0);
    expect(result.socHourly.every((s) => Number.isFinite(s) && s >= 0)).toBe(
      true
    );
    expect(Math.abs(result.energyBalanceErrorKwh)).toBeLessThan(
      ENERGY_BALANCE_TOL_KWH
    );
  });

  it("7. energy balance with reserve, PV, load and self-discharge", () => {
    const load = hourlyProfile((h) => {
      const hourOfDay = h % 24;
      if (hourOfDay >= 18 || hourOfDay < 6) return 0.6;
      return 0.2;
    });
    const pv = hourlyProfile((h) => {
      const hourOfDay = h % 24;
      return hourOfDay >= 10 && hourOfDay < 16 ? 1.5 : 0;
    });
    const result = calculateBatterySimulation(
      load,
      pv,
      10,
      DEFAULT_BATTERY_SPEC,
      2
    );
    expect(result.socStartKwh).toBe(2);
    expect(Math.abs(result.energyBalanceErrorKwh)).toBeLessThan(
      ENERGY_BALANCE_TOL_KWH
    );
  });

  it("8. existing no-reserve simulations remain within floating-point tolerance", () => {
    const load = constantProfile(0.5);
    const pv = constantProfile(0.8);
    const a = calculateBatterySimulation(
      load,
      pv,
      10,
      DEFAULT_BATTERY_SPEC,
      0
    );
    const b = calculateBatterySimulation(
      load,
      pv,
      10,
      DEFAULT_BATTERY_SPEC,
      undefined
    );
    expect(a.socStartKwh).toBe(0);
    expect(b.socStartKwh).toBe(0);
    expect(a.selfConsumptionWithStorage).toBe(b.selfConsumptionWithStorage);
    expect(a.totalChargedKwh).toBeCloseTo(b.totalChargedKwh, 12);
    expect(a.energyBalanceErrorKwh).toBeCloseTo(b.energyBalanceErrorKwh, 12);
    expect(Math.abs(a.energyBalanceErrorKwh)).toBeLessThan(
      ENERGY_BALANCE_TOL_KWH
    );
  });

  it("9. negative reserve is clamped to zero (core API); never negative or NaN SoC", () => {
    // UI validation rejects reserve < 0; core clamps via minSoc ∈ [0, maxSoc].
    const result = calculateBatterySimulation(
      constantProfile(0.5),
      constantProfile(0),
      10,
      {
        ...DEFAULT_BATTERY_SPEC,
        selfDischargePerMonth: 0,
        auxiliaryPowerW: 0,
      },
      -2
    );
    expect(result.socStartKwh).toBe(0);
    expect(result.socStartPct).toBe(0);
    expect(result.socEndKwh).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.socStartKwh)).toBe(true);
    expect(result.socHourly.every((s) => Number.isFinite(s) && s >= 0)).toBe(
      true
    );
    expect(Math.abs(result.energyBalanceErrorKwh)).toBeLessThan(
      ENERGY_BALANCE_TOL_KWH
    );
  });

  it("10. reserve equal to capacity: starts at maxSoc with no discharge headroom", () => {
    const result = calculateBatterySimulation(
      constantProfile(1),
      constantProfile(0),
      10,
      {
        ...DEFAULT_BATTERY_SPEC,
        depthOfDischarge: 1.0,
        selfDischargePerMonth: 0,
        auxiliaryPowerW: 0,
      },
      10
    );
    expect(result.socStartKwh).toBe(10);
    expect(result.socStartPct).toBe(100);
    expect(result.batteryToHouseholdKwh).toBe(0);
    expect(result.totalDischargedKwh).toBe(0);
  });

  it("11. reserve greater than capacity: capped at maxSoc", () => {
    const result = calculateBatterySimulation(
      constantProfile(1),
      constantProfile(0),
      10,
      {
        ...DEFAULT_BATTERY_SPEC,
        depthOfDischarge: 1.0,
        selfDischargePerMonth: 0,
        auxiliaryPowerW: 0,
      },
      25
    );
    expect(result.socStartKwh).toBe(10);
    expect(result.socStartPct).toBe(100);
    expect(result.batteryToHouseholdKwh).toBe(0);
    expect(Math.max(...result.socHourly)).toBeLessThanOrEqual(1 + 1e-12);
  });

  it("12. reserve with depthOfDischarge < 1 caps minSoc and initial SoC at maxSoc", () => {
    const maxSoc = 0.9;
    const result = calculateBatterySimulation(
      constantProfile(1),
      constantProfile(0),
      10,
      {
        ...DEFAULT_BATTERY_SPEC,
        depthOfDischarge: maxSoc,
        selfDischargePerMonth: 0,
        auxiliaryPowerW: 0,
      },
      15
    );
    // minSoc = clamp(15/10, 0, 0.9) = 0.9; initialSocKwh = 0.9 × 10 = 9
    expect(result.socStartKwh).toBeCloseTo(9, 12);
    expect(result.socStartPct).toBeCloseTo(90, 12);
    expect(result.batteryToHouseholdKwh).toBe(0);
    expect(Math.max(...result.socHourly)).toBeLessThanOrEqual(maxSoc + 1e-12);
    expect(result.socStartKwh).toBeLessThanOrEqual(10 * maxSoc + 1e-12);
    expect(DEFAULT_BATTERY_SPEC.depthOfDischarge).toBe(1.0);
  });
});

describe("optional hourly series and SoC throughput", () => {
  it("omits extra hourly arrays by default and still returns socHourly", () => {
    const result = calculateBatterySimulation(
      constantProfile(0.5),
      constantProfile(0.8),
      10,
      DEFAULT_BATTERY_SPEC,
      0
    );
    expect(result.socHourly).toHaveLength(HOURS_PER_YEAR);
    expect(result.hourlyChargeKwh).toBeUndefined();
    expect(result.hourlyDischargeKwh).toBeUndefined();
    expect(result.hourlyGridImportKwh).toBeUndefined();
    expect(result.hourlyGridExportKwh).toBeUndefined();
  });

  it("includeHourly=true returns 8760-length series whose sums match annuals", () => {
    const result = calculateBatterySimulation(
      constantProfile(0.5),
      constantProfile(0.8),
      10,
      DEFAULT_BATTERY_SPEC,
      0,
      { includeHourly: true }
    );
    expect(result.hourlyChargeKwh).toHaveLength(HOURS_PER_YEAR);
    expect(result.hourlyDischargeKwh).toHaveLength(HOURS_PER_YEAR);
    expect(result.hourlyGridImportKwh).toHaveLength(HOURS_PER_YEAR);
    expect(result.hourlyGridExportKwh).toHaveLength(HOURS_PER_YEAR);

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    expect(sum(result.hourlyChargeKwh!)).toBeCloseTo(result.totalChargedKwh, 9);
    expect(sum(result.hourlyDischargeKwh!)).toBeCloseTo(
      result.totalDischargedKwh,
      9
    );
    expect(sum(result.hourlyGridImportKwh!)).toBeCloseTo(
      result.gridToHouseholdKwh + result.gridToAuxiliaryKwh,
      9
    );
    expect(sum(result.hourlyGridExportKwh!)).toBeCloseTo(
      result.gridExportKwh,
      9
    );
  });

  it("does not change annual KPIs when includeHourly is toggled", () => {
    const load = constantProfile(0.5);
    const pv = constantProfile(0.8);
    const off = calculateBatterySimulation(load, pv, 10, DEFAULT_BATTERY_SPEC, 0);
    const on = calculateBatterySimulation(
      load,
      pv,
      10,
      DEFAULT_BATTERY_SPEC,
      0,
      { includeHourly: true }
    );
    expect(on.selfConsumptionWithStorage).toBe(off.selfConsumptionWithStorage);
    expect(on.totalChargedKwh).toBe(off.totalChargedKwh);
    expect(on.totalDischargedKwh).toBe(off.totalDischargedKwh);
    expect(on.gridExportKwh).toBe(off.gridExportKwh);
    expect(on.energyBalanceErrorKwh).toBe(off.energyBalanceErrorKwh);
    expect(on.cyclesPerYear).toBe(off.cyclesPerYear);
  });

  it("exposes SoC throughput; AC discharge undercounts pack energy when discharging", () => {
    const load = hourlyProfile((h) => ((h % 24) >= 18 || (h % 24) < 6 ? 0.8 : 0.2));
    const pv = hourlyProfile((h) => ((h % 24) >= 10 && (h % 24) < 16 ? 1.5 : 0));
    const result = calculateBatterySimulation(
      load,
      pv,
      10,
      DEFAULT_BATTERY_SPEC,
      0
    );
    expect(result.totalChargedStoredKwh).toBeGreaterThan(0);
    expect(result.totalDischargedFromSocKwh).toBeGreaterThan(0);
    expect(result.totalChargedStoredKwh).toBeLessThan(result.totalChargedKwh);
    expect(result.totalDischargedFromSocKwh).toBeGreaterThan(
      result.totalDischargedKwh
    );
    expect(result.cyclesPerYear).toBeCloseTo(
      result.totalDischargedKwh / 10,
      12
    );
  });
});
