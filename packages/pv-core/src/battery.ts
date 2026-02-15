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
  spec: BatterySpec = DEFAULT_BATTERY_SPEC
): BatterySimulationResult {
  if (
    loadKwh.length !== HOURS_PER_YEAR ||
    pvKwh.length !== HOURS_PER_YEAR ||
    usableCapacityKwh <= 0
  ) {
    throw new Error("Invalid inputs for battery simulation");
  }

  const socHourly: number[] = [];
  let soc = 0;
  let totalCharged = 0;
  let totalDischarged = 0;
  let selfConsumptionWithStorage = 0;

  const eff = spec.roundtripEfficiency;

  for (let h = 0; h < HOURS_PER_YEAR; h++) {
    const pv = pvKwh[h];
    const load = loadKwh[h];
    const directUse = Math.min(pv, load);
    const surplus = Math.max(0, pv - load);
    const deficit = Math.max(0, load - pv);

    if (surplus > 0) {
      const chargeRoom = (1 - soc) * usableCapacityKwh;
      const toCharge = Math.min(surplus, chargeRoom);
      soc += toCharge / usableCapacityKwh;
      totalCharged += toCharge;
    }

    let fromBattery = 0;
    if (deficit > 0 && soc > 0) {
      const maxDischarge = soc * usableCapacityKwh;
      fromBattery = Math.min(deficit, maxDischarge);
      soc -= fromBattery / usableCapacityKwh;
      totalDischarged += fromBattery;
    }

    selfConsumptionWithStorage += directUse + fromBattery;
    socHourly.push(Math.max(0, Math.min(1, soc)));
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
