/**
 * Battery Manufacturer Data Model
 * 
 * Static configuration for battery specifications.
 * This data is NOT user-editable in MVP.
 * 
 * Can be extended later for specific manufacturers:
 * BYD, Huawei, Sonnen, Tesla, etc.
 */

/**
 * Battery specification from manufacturer
 */
export interface BatterySpec {
  /** Manufacturer name */
  manufacturer: string;
  
  /** Battery chemistry (e.g., LiFePO4, NMC) */
  chemistry: string;
  
  /** Round-trip efficiency (charge → discharge) */
  roundtripEfficiency: number;
  
  /** Cycle life at 80% remaining capacity */
  cycleLife80Pct: number;
  
  /** Calendar lifetime in years (upper bound) */
  calendarLifeYears: number;
  
  /** Depth of discharge assumption (0-1) */
  depthOfDischarge: number;
}

/**
 * Default LiFePO4 reference model for MVP
 * 
 * Based on conservative 2024-2025 market data.
 * This is NOT a warranty promise, but a calculation baseline.
 */
export const DEFAULT_BATTERY_SPEC: BatterySpec = {
  manufacturer: "Generic LFP",
  chemistry: "LiFePO4",
  roundtripEfficiency: 0.94,
  cycleLife80Pct: 6000,
  calendarLifeYears: 15,
  depthOfDischarge: 0.9, // 90% usable capacity
};

/**
 * Lifecycle calculation result for a specific battery scenario
 */
export interface LifecycleResult {
  /** Battery capacity in kWh */
  capacityKwh: number;
  
  /** Estimated cycles per year based on usage */
  cyclesPerYear: number;
  
  /** Lifetime limited by cycle count (years) */
  lifetimeByCyclesYears: number;
  
  /** Lifetime limited by calendar age (years) */
  lifetimeByCalendarYears: number;
  
  /** Effective lifetime (min of both limits) */
  effectiveLifetimeYears: number;
  
  /** Which factor limits the lifetime: "cycles" | "calendar" */
  limitingFactor: "cycles" | "calendar";
}

/**
 * Calculate cycles per year based on discharged energy
 * 
 * @param totalDischargedEnergyKwh - Total energy discharged per year
 * @param usableCapacityKwh - Usable battery capacity
 * @returns Number of full equivalent cycles per year
 */
export function calculateCyclesPerYear(
  totalDischargedEnergyKwh: number,
  usableCapacityKwh: number
): number {
  if (usableCapacityKwh <= 0) return 0;
  return totalDischargedEnergyKwh / usableCapacityKwh;
}

/**
 * Calculate effective battery lifetime using dual-limit model
 * 
 * The battery lifetime is limited by BOTH:
 * 1. Calendar age (physical degradation over time)
 * 2. Cycle count (wear from charging/discharging)
 * 
 * The effective lifetime is the minimum of both limits.
 * 
 * @param cyclesPerYear - Calculated cycles per year
 * @param spec - Battery specification
 * @returns Lifecycle calculation result
 */
export function calculateLifecycle(
  capacityKwh: number,
  cyclesPerYear: number,
  spec: BatterySpec = DEFAULT_BATTERY_SPEC
): LifecycleResult {
  // Calendar lifetime (fixed upper bound)
  const lifetimeByCalendarYears = spec.calendarLifeYears;
  
  // Cycle-limited lifetime
  const lifetimeByCyclesYears = cyclesPerYear > 0
    ? spec.cycleLife80Pct / cyclesPerYear
    : spec.calendarLifeYears; // If no cycling, calendar is the limit
  
  // Effective lifetime is the minimum of both
  const effectiveLifetimeYears = Math.min(
    lifetimeByCalendarYears,
    lifetimeByCyclesYears
  );
  
  // Determine which factor is limiting
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

/**
 * Estimate annual discharged energy based on self-consumption increase
 * 
 * This is a simplified model based on:
 * - How much additional PV energy is stored vs direct use
 * - Typical daily charge/discharge patterns
 * 
 * @param pvSelfConsumptionIncreaseKwh - Additional self-consumption enabled by battery
 * @param efficiencyLoss - Energy lost in round-trip (1 - efficiency)
 * @returns Estimated total discharged energy per year
 */
export function estimateAnnualDischargedEnergy(
  pvSelfConsumptionIncreaseKwh: number,
  roundtripEfficiency: number = DEFAULT_BATTERY_SPEC.roundtripEfficiency
): number {
  // The battery discharges what was stored (minus losses)
  // pvSelfConsumptionIncrease represents energy that would have been fed in
  // but is now stored and used later
  
  // Account for efficiency: stored energy = discharged energy × efficiency
  // So discharged energy = stored energy / efficiency
  return pvSelfConsumptionIncreaseKwh / roundtripEfficiency;
}


