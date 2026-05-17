import { describe, expect, it } from "vitest";
import {
  resolveBatteryPowerLimitsKw,
  resolveHybridBatteryPowerLimitKw,
} from "./batteryPowerLimit";

describe("resolveHybridBatteryPowerLimitKw", () => {
  it("uses the indicative hybrid bins", () => {
    expect(resolveHybridBatteryPowerLimitKw(5)).toBe(2.5);
    expect(resolveHybridBatteryPowerLimitKw(5.1)).toBe(3.5);
    expect(resolveHybridBatteryPowerLimitKw(9.9)).toBe(3.5);
    expect(resolveHybridBatteryPowerLimitKw(10)).toBe(5.0);
    expect(resolveHybridBatteryPowerLimitKw(15)).toBe(5.0);
    expect(resolveHybridBatteryPowerLimitKw(15.1)).toBe(6.0);
  });
});

describe("resolveBatteryPowerLimitsKw", () => {
  it("applies explicit kW overrides per side", () => {
    const r = resolveBatteryPowerLimitsKw(20, {
      maxChargePowerKw: 4,
      maxDischargePowerKw: 8,
    });
    expect(r).toEqual({ chargePowerKw: 4, dischargePowerKw: 8 });
  });

  it("supports legacy 0.5C via C-rate override", () => {
    const r = resolveBatteryPowerLimitsKw(10, {
      maxChargeCRate: 0.5,
      maxDischargeCRate: 0.5,
    });
    expect(r).toEqual({ chargePowerKw: 5, dischargePowerKw: 5 });
  });

  it("prefers explicit kW over C-rate on that side", () => {
    const r = resolveBatteryPowerLimitsKw(10, {
      maxChargePowerKw: 2,
      maxChargeCRate: 0.5,
      maxDischargeCRate: 0.5,
    });
    expect(r.chargePowerKw).toBe(2);
    expect(r.dischargePowerKw).toBe(5);
  });

  it("defaults both sides to the hybrid curve without overrides", () => {
    expect(resolveBatteryPowerLimitsKw(10, {})).toEqual({
      chargePowerKw: 5,
      dischargePowerKw: 5,
    });
  });
});
