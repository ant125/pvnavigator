import { describe, expect, it } from "vitest";
import {
  calculateBatterySimulation,
  DEFAULT_BATTERY_SPEC,
  DEFAULT_TIME_STEP_HOURS,
} from "./battery";

const ENERGY_BALANCE_TOL_KWH = 1e-9;
const HOURS_PER_MONTH_AVG = (365 * 24) / 12;

function steps(n: number, value: number): number[] {
  return Array.from({ length: n }, () => value);
}

function stepsFrom(values: number[]): number[] {
  return values.slice();
}

const POWER_SPEC = {
  ...DEFAULT_BATTERY_SPEC,
  maxChargePowerKw: 5,
  maxDischargePowerKw: 5,
  auxiliaryPowerW: 0,
  selfDischargePerMonth: 0,
} as const;

describe("timestep contract", () => {
  it("defaults timeStepHours to 1", () => {
    expect(DEFAULT_TIME_STEP_HOURS).toBe(1);
  });

  it("rejects mismatched load/pv lengths and non-positive timeStepHours", () => {
    expect(() =>
      calculateBatterySimulation([1], [1, 2], 10, DEFAULT_BATTERY_SPEC, 0)
    ).toThrow(/Invalid inputs/);
    expect(() =>
      calculateBatterySimulation([], [], 10, DEFAULT_BATTERY_SPEC, 0)
    ).toThrow(/Invalid inputs/);
    expect(() =>
      calculateBatterySimulation([1], [1], 10, DEFAULT_BATTERY_SPEC, 0, {
        timeStepHours: 0,
      })
    ).toThrow(/Invalid inputs/);
    expect(() =>
      calculateBatterySimulation([1], [1], 10, DEFAULT_BATTERY_SPEC, 0, {
        timeStepHours: -0.25,
      })
    ).toThrow(/Invalid inputs/);
  });

  it("accepts a non-8760 step count", () => {
    const result = calculateBatterySimulation(
      steps(4, 0),
      steps(4, 0),
      10,
      { ...DEFAULT_BATTERY_SPEC, auxiliaryPowerW: 0, selfDischargePerMonth: 0 },
      0,
      { timeStepHours: 0.25 }
    );
    expect(result.socHourly).toHaveLength(4);
  });
});

describe("power limits scale with timeStepHours", () => {
  it("dt=1: max charge energy per step is 5 kWh at 5 kW", () => {
    const result = calculateBatterySimulation(
      steps(1, 0),
      steps(1, 100),
      100,
      POWER_SPEC,
      0,
      { includeHourly: true, timeStepHours: 1 }
    );
    expect(result.hourlyChargeKwh![0]).toBe(5);
    expect(result.totalChargedKwh).toBe(5);
  });

  it("dt=0.25: max charge energy per step is 1.25 kWh at 5 kW", () => {
    const result = calculateBatterySimulation(
      steps(1, 0),
      steps(1, 100),
      100,
      POWER_SPEC,
      0,
      { includeHourly: true, timeStepHours: 0.25 }
    );
    expect(result.hourlyChargeKwh![0]).toBe(1.25);
    expect(result.totalChargedKwh).toBe(1.25);
  });

  it("dt=1: max discharge energy per step is 5 kWh at 5 kW", () => {
    const result = calculateBatterySimulation(
      stepsFrom([0, 100]),
      stepsFrom([50, 0]),
      100,
      {
        ...POWER_SPEC,
        maxChargePowerKw: 100,
        maxDischargePowerKw: 5,
      },
      0,
      { includeHourly: true, timeStepHours: 1 }
    );
    expect(result.hourlyDischargeKwh![1]).toBe(5);
  });

  it("dt=0.25: max discharge energy per step is 1.25 kWh at 5 kW", () => {
    const result = calculateBatterySimulation(
      stepsFrom([0, 100]),
      stepsFrom([50, 0]),
      100,
      {
        ...POWER_SPEC,
        maxChargePowerKw: 100,
        maxDischargePowerKw: 5,
      },
      0,
      { includeHourly: true, timeStepHours: 0.25 }
    );
    expect(result.hourlyDischargeKwh![1]).toBe(1.25);
  });
});

describe("standby auxiliary energy scales with timeStepHours", () => {
  const auxSpec = {
    ...DEFAULT_BATTERY_SPEC,
    auxiliaryPowerW: 15,
    selfDischargePerMonth: 0,
  };

  it("dt=1: 0.015 kWh per step", () => {
    const result = calculateBatterySimulation(
      steps(1, 0),
      steps(1, 0),
      10,
      auxSpec,
      0,
      { timeStepHours: 1 }
    );
    expect(result.auxiliaryConsumptionKwh).toBeCloseTo(0.015, 12);
  });

  it("dt=0.25: 0.00375 kWh per step", () => {
    const result = calculateBatterySimulation(
      steps(1, 0),
      steps(1, 0),
      10,
      auxSpec,
      0,
      { timeStepHours: 0.25 }
    );
    expect(result.auxiliaryConsumptionKwh).toBeCloseTo(0.00375, 12);
  });

  it("four dt=0.25 steps equal one dt=1 step of standby energy", () => {
    const qh = calculateBatterySimulation(
      steps(4, 0),
      steps(4, 0),
      10,
      auxSpec,
      0,
      { timeStepHours: 0.25 }
    );
    const hour = calculateBatterySimulation(
      steps(1, 0),
      steps(1, 0),
      10,
      auxSpec,
      0,
      { timeStepHours: 1 }
    );
    expect(qh.auxiliaryConsumptionKwh).toBeCloseTo(0.015, 12);
    expect(qh.auxiliaryConsumptionKwh).toBeCloseTo(
      hour.auxiliaryConsumptionKwh,
      12
    );
  });
});

describe("self-discharge retention per step", () => {
  const idleSpec = {
    ...DEFAULT_BATTERY_SPEC,
    auxiliaryPowerW: 0,
    selfDischargePerMonth: 0.01,
  };

  it("r_step^4 equals r_hour at dt=0.25", () => {
    const rHour = Math.pow(1 - 0.01, 1 / HOURS_PER_MONTH_AVG);
    const rStep = Math.pow(rHour, 0.25);
    expect(rStep ** 4).toBeCloseTo(rHour, 15);
  });

  it("four idle dt=0.25 steps match one idle dt=1 step SoC", () => {
    const hour = calculateBatterySimulation(
      steps(1, 0),
      steps(1, 0),
      10,
      idleSpec,
      2,
      { timeStepHours: 1 }
    );
    const qh = calculateBatterySimulation(
      steps(4, 0),
      steps(4, 0),
      10,
      idleSpec,
      2,
      { timeStepHours: 0.25 }
    );
    expect(qh.socEndKwh).toBeCloseTo(hour.socEndKwh, 12);
    expect(qh.socEndPct).toBeCloseTo(hour.socEndPct, 12);
    expect(qh.totalSelfDischargeLossKwh).toBeCloseTo(
      hour.totalSelfDischargeLossKwh,
      12
    );
    expect(qh.socStartKwh).toBe(hour.socStartKwh);
  });
});

describe("per-step energy balance and sequential SoC at dt=0.25", () => {
  it("household and PV ledgers close per step; SoC ledger residual is noise", () => {
    const load = [0.2, 0.8, 0.1, 0.4];
    const pv = [0.5, 0.0, 0.3, 0.0];
    const result = calculateBatterySimulation(
      load,
      pv,
      10,
      {
        ...DEFAULT_BATTERY_SPEC,
        auxiliaryPowerW: 0,
        maxChargePowerKw: 5,
        maxDischargePowerKw: 5,
      },
      2,
      { includeHourly: true, timeStepHours: 0.25 }
    );

    expect(Math.abs(result.energyBalanceErrorKwh)).toBeLessThan(
      ENERGY_BALANCE_TOL_KWH
    );

    for (let i = 0; i < 4; i++) {
      const directPvToHousehold = Math.min(pv[i], load[i]);
      expect(
        directPvToHousehold +
          result.hourlyDischargeKwh![i] +
          result.hourlyGridImportKwh![i]
      ).toBeCloseTo(load[i], 12);
      expect(
        directPvToHousehold +
          result.hourlyChargeKwh![i] +
          result.hourlyGridExportKwh![i]
      ).toBeCloseTo(pv[i], 12);
    }

    expect(result.selfConsumptionWithStorage).toBeCloseTo(
      result.directPvToHouseholdKwh + result.batteryToHouseholdKwh,
      12
    );
    expect(result.gridToHouseholdKwh).toBeCloseTo(
      load.reduce((a, b) => a + b, 0) - result.selfConsumptionWithStorage,
      12
    );
  });

  it("SoC after each idle step is the start SoC of the next step", () => {
    const rHour = Math.pow(1 - 0.01, 1 / HOURS_PER_MONTH_AVG);
    const rStep = Math.pow(rHour, 0.25);
    const result = calculateBatterySimulation(
      steps(4, 0),
      steps(4, 0),
      10,
      {
        ...DEFAULT_BATTERY_SPEC,
        auxiliaryPowerW: 0,
        selfDischargePerMonth: 0.01,
      },
      2,
      { timeStepHours: 0.25 }
    );

    const startFrac = result.socStartKwh / 10;
    expect(result.socHourly[0]).toBeCloseTo(startFrac * rStep, 12);
    for (let i = 1; i < 4; i++) {
      expect(result.socHourly[i]).toBeCloseTo(
        result.socHourly[i - 1] * rStep,
        12
      );
    }
    expect(result.socEndKwh / 10).toBeCloseTo(result.socHourly[3], 12);
  });
});

describe("synthetic CPU benchmark (not a product path)", () => {
  it("times 8760×dt=1 vs 35040×dt=0.25 for one battery", () => {
    const spec = {
      ...DEFAULT_BATTERY_SPEC,
      auxiliaryPowerW: 15,
      selfDischargePerMonth: 0.01,
    };

    const loadHour = Array.from({ length: 8760 }, (_, h) =>
      h % 24 >= 18 || h % 24 < 6 ? 0.6 : 0.2
    );
    const pvHour = Array.from({ length: 8760 }, (_, h) =>
      h % 24 >= 10 && h % 24 < 16 ? 1.5 : 0
    );
    const loadQh = Array.from({ length: 35040 }, (_, i) => loadHour[Math.floor(i / 4)] / 4);
    const pvQh = Array.from({ length: 35040 }, (_, i) => pvHour[Math.floor(i / 4)] / 4);

    const t0 = performance.now();
    const hour = calculateBatterySimulation(loadHour, pvHour, 10, spec, 0, {
      timeStepHours: 1,
    });
    const ms8760 = performance.now() - t0;

    const t1 = performance.now();
    const qh = calculateBatterySimulation(loadQh, pvQh, 10, spec, 0, {
      timeStepHours: 0.25,
    });
    const ms35040 = performance.now() - t1;

    expect(hour.socHourly).toHaveLength(8760);
    expect(qh.socHourly).toHaveLength(35040);
    expect(Math.abs(hour.energyBalanceErrorKwh)).toBeLessThan(ENERGY_BALANCE_TOL_KWH);
    // More steps accumulate slightly more float noise than the 8760 1e-9 gate.
    expect(Math.abs(qh.energyBalanceErrorKwh)).toBeLessThan(1e-8);

    // eslint-disable-next-line no-console
    console.log(
      `battery timestep benchmark (1×10 kWh): 8760×dt=1 ${ms8760.toFixed(1)} ms; 35040×dt=0.25 ${ms35040.toFixed(1)} ms; ratio ${(ms35040 / ms8760).toFixed(2)}×`
    );
  });
});
