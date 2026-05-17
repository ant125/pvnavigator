/**
 * Default hybrid inverter usable power (charge and discharge, AC side, hourly kW)
 * for home LiFePO4 systems used by the battery dispatcher.
 */

/** Optional overrides read from `BatterySpec` for power resolution. */
export interface BatteryPowerLimitFields {
  /** Explicit max charge power (kW). Highest precedence per side. */
  maxChargePowerKw?: number;
  /** Explicit max discharge power (kW). Highest precedence per side. */
  maxDischargePowerKw?: number;
  /** Charge power as C-rate × usable capacity when kW override is absent. */
  maxChargeCRate?: number;
  /** Discharge power as C-rate × usable capacity when kW override is absent. */
  maxDischargeCRate?: number;
}

/**
 * Indicative modern hybrid LiFePO₄ home storage inverter power curve (AC usable power, kW),
 * not a manufacturer-specific datasheet. Used when neither kW nor C-rate overrides are set.
 */
export function resolveHybridBatteryPowerLimitKw(
  storageSizeKwh: number
): number {
  if (storageSizeKwh <= 5) return 2.5;
  if (storageSizeKwh > 5 && storageSizeKwh < 10) return 3.5;
  if (storageSizeKwh >= 10 && storageSizeKwh <= 15) return 5.0;
  return 6.0;
}

function resolveChargePowerKw(
  usableCapacityKwh: number,
  spec: BatteryPowerLimitFields
): number {
  if (
    typeof spec.maxChargePowerKw === "number" &&
    Number.isFinite(spec.maxChargePowerKw)
  ) {
    return spec.maxChargePowerKw;
  }
  if (
    typeof spec.maxChargeCRate === "number" &&
    Number.isFinite(spec.maxChargeCRate)
  ) {
    return usableCapacityKwh * spec.maxChargeCRate;
  }
  return resolveHybridBatteryPowerLimitKw(usableCapacityKwh);
}

function resolveDischargePowerKw(
  usableCapacityKwh: number,
  spec: BatteryPowerLimitFields
): number {
  if (
    typeof spec.maxDischargePowerKw === "number" &&
    Number.isFinite(spec.maxDischargePowerKw)
  ) {
    return spec.maxDischargePowerKw;
  }
  if (
    typeof spec.maxDischargeCRate === "number" &&
    Number.isFinite(spec.maxDischargeCRate)
  ) {
    return usableCapacityKwh * spec.maxDischargeCRate;
  }
  return resolveHybridBatteryPowerLimitKw(usableCapacityKwh);
}

/**
 * Hourly charge/discharge power caps (kW) for the battery hourly simulation.
 *
 * Precedence per side: explicit kW → C-rate × usable kWh → hybrid default curve.
 */
export function resolveBatteryPowerLimitsKw(
  usableCapacityKwh: number,
  spec: BatteryPowerLimitFields
): { chargePowerKw: number; dischargePowerKw: number } {
  return {
    chargePowerKw: resolveChargePowerKw(usableCapacityKwh, spec),
    dischargePowerKw: resolveDischargePowerKw(usableCapacityKwh, spec),
  };
}
