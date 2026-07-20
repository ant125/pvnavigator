import { describe, expect, it } from "vitest";
import {
  calculateBatterySimulation,
  DEFAULT_BATTERY_SPEC,
} from "./battery";

const HOURS_PER_YEAR = 8760;

function constantProfile(value: number): number[] {
  return Array.from({ length: HOURS_PER_YEAR }, () => value);
}

describe("DEFAULT_BATTERY_SPEC.depthOfDischarge", () => {
  it("defaults to 1.0 for market-usable capacity envelope", () => {
    expect(DEFAULT_BATTERY_SPEC.depthOfDischarge).toBe(1.0);
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

  it("applies backupReserveKwh independently of DoD", () => {
    const load = constantProfile(0.1);
    const pv = constantProfile(5);
    const spec = { ...DEFAULT_BATTERY_SPEC, depthOfDischarge: 1.0 };
    const result = calculateBatterySimulation(load, pv, 10, spec, 2);
    expect(Math.min(...result.socHourly)).toBeGreaterThanOrEqual(0.2 - 1e-6);
    expect(Math.max(...result.socHourly)).toBeCloseTo(1.0, 3);
  });
});
