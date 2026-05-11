/**
 * Battery simulation and lifecycle – verified physics.
 * Pure math, no I/O, no React.
 */

const HOURS_PER_YEAR = 8760;

export interface BatterySpec {
  manufacturer: string;
  chemistry: string;
  roundtripEfficiency: number;
  cycleLife80Pct: number;
  calendarLifeYears: number;
  depthOfDischarge: number;
}

export const DEFAULT_BATTERY_SPEC: BatterySpec = {
  manufacturer: "Generic LFP",
  chemistry: "LiFePO4",
  roundtripEfficiency: 0.94,
  cycleLife80Pct: 6000,
  calendarLifeYears: 15,
  depthOfDischarge: 0.9,
};

export interface BatterySimulationResult {
  socHourly: number[];
  totalChargedKwh: number;
  totalDischargedKwh: number;
  cyclesPerYear: number;
  selfConsumptionWithStorage: number;
}

/**
 * Run hourly battery simulation over 8760h.
 * PV surplus charges battery; load deficit discharges.
 */
export function calculateBatterySimulation(
  loadKwh: number[],
  pvKwh: number[],
  usableCapacityKwh: number,
  spec: BatterySpec = DEFAULT_BATTERY_SPEC,
  backupReserveKwh?: number
): BatterySimulationResult {
  if (
    loadKwh.length !== HOURS_PER_YEAR ||
    pvKwh.length !== HOURS_PER_YEAR ||
    usableCapacityKwh <= 0
  ) {
    throw new Error("Invalid inputs for battery simulation");
  }

  const reserveKwh = backupReserveKwh ?? 0;
  const minSoc =
    reserveKwh > 0 ? reserveKwh / usableCapacityKwh : 0;

  const socHourly: number[] = [];
  let soc = 0;
  let totalCharged = 0;
  let totalDischarged = 0;
  let selfConsumptionWithStorage = 0;

  const eff = spec.roundtripEfficiency;
  const etaChg = Math.sqrt(eff);
  const etaDis = Math.sqrt(eff);
  const maxSoc = spec.depthOfDischarge;
  const chargePowerKw = usableCapacityKwh * 0.5;
  const dischargePowerKw = usableCapacityKwh * 0.5;

  for (let h = 0; h < HOURS_PER_YEAR; h++) {
    const pv = pvKwh[h];
    const load = loadKwh[h];
    const directUse = Math.min(pv, load);
    const surplus = Math.max(0, pv - load);
    const deficit = Math.max(0, load - pv);

    if (surplus > 0) {
      const chargeRoom = (maxSoc - soc) * usableCapacityKwh;
      const toChargeRaw = Math.min(
        surplus,
        Math.max(0, chargeRoom),
        chargePowerKw
      );
      const toChargeStored = toChargeRaw * etaChg;
      soc += toChargeStored / usableCapacityKwh;
      totalCharged += toChargeRaw;
    }

    let fromBattery = 0;
    if (deficit > 0 && soc > minSoc) {
      const maxDischargeRaw = (soc - minSoc) * usableCapacityKwh;
      const maxDischargeAvailable = maxDischargeRaw * etaDis;
      fromBattery = Math.min(
        deficit,
        maxDischargeAvailable,
        dischargePowerKw
      );
      soc -= fromBattery / etaDis / usableCapacityKwh;
      totalDischarged += fromBattery;
    }

    soc = Math.max(soc, minSoc);
    if (soc > maxSoc) soc = maxSoc;

    selfConsumptionWithStorage += directUse + fromBattery;
    socHourly.push(soc);
  }

  const cyclesPerYear =
    usableCapacityKwh > 0 ? totalDischarged / usableCapacityKwh : 0;

  return {
    socHourly,
    totalChargedKwh: totalCharged,
    totalDischargedKwh: totalDischarged,
    cyclesPerYear,
    selfConsumptionWithStorage,
  };
}

export interface LifecycleResult {
  capacityKwh: number;
  cyclesPerYear: number;
  lifetimeByCyclesYears: number;
  lifetimeByCalendarYears: number;
  effectiveLifetimeYears: number;
  limitingFactor: "cycles" | "calendar";
}

export function calculateCyclesPerYear(
  totalDischargedEnergyKwh: number,
  usableCapacityKwh: number
): number {
  if (usableCapacityKwh <= 0) return 0;
  return totalDischargedEnergyKwh / usableCapacityKwh;
}

export function calculateLifecycle(
  capacityKwh: number,
  cyclesPerYear: number,
  spec: BatterySpec = DEFAULT_BATTERY_SPEC
): LifecycleResult {
  const lifetimeByCalendarYears = spec.calendarLifeYears;
  const lifetimeByCyclesYears =
    cyclesPerYear > 0
      ? spec.cycleLife80Pct / cyclesPerYear
      : spec.calendarLifeYears;
  const effectiveLifetimeYears = Math.min(
    lifetimeByCalendarYears,
    lifetimeByCyclesYears
  );
  const limitingFactor: "cycles" | "calendar" =
    lifetimeByCyclesYears < lifetimeByCalendarYears ? "cycles" : "calendar";

  return {
    capacityKwh,
    cyclesPerYear: Math.round(cyclesPerYear),
    lifetimeByCyclesYears: Math.round(lifetimeByCyclesYears * 10) / 10,
    lifetimeByCalendarYears,
    effectiveLifetimeYears: Math.round(effectiveLifetimeYears * 10) / 10,
    limitingFactor,
  };
}

export function estimateAnnualDischargedEnergy(
  pvSelfConsumptionIncreaseKwh: number,
  roundtripEfficiency: number = DEFAULT_BATTERY_SPEC.roundtripEfficiency
): number {
  return pvSelfConsumptionIncreaseKwh / roundtripEfficiency;
}
