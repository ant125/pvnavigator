/**
 * Battery simulation and lifecycle – verified physics.
 * Pure math, no I/O, no React.
 */

import {
  resolveBatteryPowerLimitsKw,
  type BatteryPowerLimitFields,
} from "./batteryPowerLimit";

const HOURS_PER_YEAR = 8760;
/** Average hours per calendar month for hourly self-discharge compounding */
const HOURS_PER_MONTH_AVG = (365 * 24) / 12;

/** Default stage efficiencies when `efficiencyModel === "hybrid"` and fields are omitted. */
const HYBRID_EFFICIENCY_DEFAULTS = {
  pvToBatteryEfficiency: 0.98,
  batteryChargeEfficiency: 0.99,
  batteryDischargeEfficiency: 0.99,
  batteryToAcEfficiency: 0.98,
} as const;

export interface BatterySpec extends BatteryPowerLimitFields {
  manufacturer: string;
  chemistry: string;
  roundtripEfficiency: number;
  cycleLife80Pct: number;
  calendarLifeYears: number;
  depthOfDischarge: number;
  /** Continuous inverter/BMS/system draw (W). AC-bus auxiliary after household PV use. */
  auxiliaryPowerW?: number;
  /** Fraction (0–1) of stored energy lost per month via self-discharge; compounded hourly. */
  selfDischargePerMonth?: number;
  /**
   * `"roundtrip"` (default): η_chg = η_dis = √roundtripEfficiency — legacy symmetric model.
   * `"hybrid"`: η_chg and η_dis from DC path + cell + inverter chain (see optional efficiency fields).
   */
  efficiencyModel?: "roundtrip" | "hybrid";
  /** PV surplus (kWh) → battery DC path efficiency; used only in hybrid mode. */
  pvToBatteryEfficiency?: number;
  /** Pack charge (coulombic / stored fraction); hybrid mode. */
  batteryChargeEfficiency?: number;
  /** Stored chemical energy → DC bus at pack; hybrid mode. */
  batteryDischargeEfficiency?: number;
  /** DC at pack → delivered AC to household/aux bus; hybrid mode. */
  batteryToAcEfficiency?: number;
}

export const DEFAULT_BATTERY_SPEC: BatterySpec = {
  manufacturer: "Generic LFP",
  chemistry: "LiFePO4",
  roundtripEfficiency: 0.94,
  cycleLife80Pct: 6000,
  calendarLifeYears: 15,
  depthOfDischarge: 0.9,
  auxiliaryPowerW: 15,
  selfDischargePerMonth: 0.01,
  efficiencyModel: "hybrid",
  ...HYBRID_EFFICIENCY_DEFAULTS,
};

export interface BatterySimulationResult {
  socHourly: number[];
  totalChargedKwh: number;
  totalDischargedKwh: number;
  cyclesPerYear: number;
  /**
   * Household Eigenverbrauch only: Σ(directPvToHousehold + batteryToHousehold).
   * Excludes auxiliary AC-bus consumption.
   */
  selfConsumptionWithStorage: number;
  /** Σ PV energy serving household load (after self-discharge step). */
  directPvToHouseholdKwh: number;
  /** Σ PV energy serving auxiliary demand. */
  directPvToAuxiliaryKwh: number;
  /** Σ AC energy from battery to household. */
  batteryToHouseholdKwh: number;
  /** Σ AC energy from battery to auxiliary. */
  batteryToAuxiliaryKwh: number;
  /** Σ grid import serving residual household deficit. */
  gridToHouseholdKwh: number;
  /** Σ grid import serving residual auxiliary deficit. */
  gridToAuxiliaryKwh: number;
  /** Σ PV surplus not stored → implicit export. */
  gridExportKwh: number;
  /** Annual auxiliary demand 8760 × (auxiliaryPowerW / 1000). */
  auxiliaryConsumptionKwh: number;
  /** Σ(toChargeRaw − toChargeStored) — charge-path inefficiency */
  chargeLossKwh: number;
  /** Σ(fromBattery/η_dis − fromBattery) — discharge-path inefficiency (house + aux). */
  dischargeLossKwh: number;
  /**
   * Hybrid loss breakdown (omitted when `efficiencyModel` is missing or `"roundtrip"`).
   * When present, partial sums equal `chargeLossKwh` and `dischargeLossKwh` respectively.
   */
  chargeLossPvToBatteryKwh?: number;
  chargeLossChemicalKwh?: number;
  dischargeLossChemicalKwh?: number;
  dischargeLossBatteryToAcKwh?: number;
  /** SOC × nominal usable envelope at hour 0 (always 0 with current initializer) */
  socStartKwh: number;
  /** SOC × nominal usable envelope after hour 8759 */
  socEndKwh: number;
  /** SOC fraction × 100 (same SOC convention as hourly arrays; typical ceiling DoD×100) */
  socEndPct: number;
  /**
   * SOC ledger residual for validation (should be ~0):
   * `(socEnd − socStart) × usableCapacityKwh − (ΣΔE_in − ΣΔE_out − ΣΔE_sd)`
   * with ΔE_in = toChargeStored per hour, ΔE_out = fromBattery/η_dis per hour,
   * and ΣΔE_sd = totalSelfDischargeLossKwh.
   */
  energyBalanceErrorKwh: number;
  /** Σ stored energy removed by hourly self-discharge compounding. */
  totalSelfDischargeLossKwh: number;
}

/**
 * Run hourly battery simulation over 8760h.
 * Dispatch: PV → household → auxiliary → battery charge → export;
 * deficits: battery → household, then battery → auxiliary; then grid (split).
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
  const socStart = soc;
  let totalCharged = 0;
  let totalDischarged = 0;
  let selfConsumptionWithStorage = 0;
  let directPvToHouseholdKwh = 0;
  let directPvToAuxiliaryKwh = 0;
  let batteryToHouseholdKwh = 0;
  let batteryToAuxiliaryKwh = 0;
  let gridToHouseholdKwh = 0;
  let gridToAuxiliaryKwh = 0;
  let gridExportKwh = 0;
  let chargeLossKwh = 0;
  let dischargeLossKwh = 0;
  let chargeLossPvToBatteryKwh = 0;
  let chargeLossChemicalKwh = 0;
  let dischargeLossChemicalKwh = 0;
  let dischargeLossBatteryToAcKwh = 0;
  let sumChargeStoredKwh = 0;
  let sumDischargeFromSocKwh = 0;
  let totalSelfDischargeLossKwh = 0;

  const auxiliaryPowerW = spec.auxiliaryPowerW ?? 0;
  const auxiliaryKwhPerHour = auxiliaryPowerW / 1000;
  const auxiliaryConsumptionKwh = auxiliaryKwhPerHour * HOURS_PER_YEAR;

  const monthlySd = spec.selfDischargePerMonth ?? 0;
  let retentionPerHour = 1;
  if (monthlySd > 0 && monthlySd < 1) {
    retentionPerHour = Math.pow(1 - monthlySd, 1 / HOURS_PER_MONTH_AVG);
  } else if (monthlySd >= 1) {
    retentionPerHour = 0;
  }

  const useHybrid = spec.efficiencyModel === "hybrid";
  const eff = spec.roundtripEfficiency;
  const etaChg = useHybrid
    ? (spec.pvToBatteryEfficiency ?? HYBRID_EFFICIENCY_DEFAULTS.pvToBatteryEfficiency) *
      (spec.batteryChargeEfficiency ?? HYBRID_EFFICIENCY_DEFAULTS.batteryChargeEfficiency)
    : Math.sqrt(eff);
  const etaDis = useHybrid
    ? (spec.batteryDischargeEfficiency ??
        HYBRID_EFFICIENCY_DEFAULTS.batteryDischargeEfficiency) *
      (spec.batteryToAcEfficiency ?? HYBRID_EFFICIENCY_DEFAULTS.batteryToAcEfficiency)
    : Math.sqrt(eff);
  const etaBattDis = useHybrid
    ? spec.batteryDischargeEfficiency ??
      HYBRID_EFFICIENCY_DEFAULTS.batteryDischargeEfficiency
    : 0;
  const etaPvToBatt = useHybrid
    ? spec.pvToBatteryEfficiency ?? HYBRID_EFFICIENCY_DEFAULTS.pvToBatteryEfficiency
    : 0;
  const etaChemChg = useHybrid
    ? spec.batteryChargeEfficiency ?? HYBRID_EFFICIENCY_DEFAULTS.batteryChargeEfficiency
    : 0;
  const maxSoc = spec.depthOfDischarge;
  const { chargePowerKw, dischargePowerKw } =
    resolveBatteryPowerLimitsKw(usableCapacityKwh, spec);

  for (let h = 0; h < HOURS_PER_YEAR; h++) {
    const pv = pvKwh[h];
    const load = loadKwh[h];

    const energyStoredBeforeSd = soc * usableCapacityKwh;
    soc *= retentionPerHour;
    const energyStoredAfterSd = soc * usableCapacityKwh;
    totalSelfDischargeLossKwh += Math.max(
      0,
      energyStoredBeforeSd - energyStoredAfterSd
    );

    soc = Math.max(soc, minSoc);
    if (soc > maxSoc) soc = maxSoc;

    // --- PV allocation: household → auxiliary → battery charge → export ---
    let pvRem = pv;

    const directPvToHousehold = Math.min(pvRem, load);
    pvRem -= directPvToHousehold;
    directPvToHouseholdKwh += directPvToHousehold;

    const directPvToAuxiliary = Math.min(pvRem, auxiliaryKwhPerHour);
    pvRem -= directPvToAuxiliary;
    directPvToAuxiliaryKwh += directPvToAuxiliary;

    let houseNeedRem = load - directPvToHousehold;
    let auxNeedRem = auxiliaryKwhPerHour - directPvToAuxiliary;

    let toChargeRaw = 0;
    if (pvRem > 0) {
      const chargeRoom = (maxSoc - soc) * usableCapacityKwh;
      toChargeRaw = Math.min(
        pvRem,
        Math.max(0, chargeRoom),
        chargePowerKw
      );
      let toChargeStored: number;
      if (useHybrid) {
        const afterPvPath = toChargeRaw * etaPvToBatt;
        toChargeStored = afterPvPath * etaChemChg;
        chargeLossPvToBatteryKwh += toChargeRaw - afterPvPath;
        chargeLossChemicalKwh += afterPvPath - toChargeStored;
      } else {
        toChargeStored = toChargeRaw * etaChg;
      }
      soc += toChargeStored / usableCapacityKwh;
      totalCharged += toChargeRaw;
      sumChargeStoredKwh += toChargeStored;
      chargeLossKwh += toChargeRaw - toChargeStored;
      pvRem -= toChargeRaw;
    }

    gridExportKwh += pvRem;

    // --- Battery: household deficit first, then auxiliary (shared power cap) ---
    let remainingBattPower = dischargePowerKw;

    let fromBattH = 0;
    if (houseNeedRem > 0 && soc > minSoc) {
      const maxDischargeRaw = (soc - minSoc) * usableCapacityKwh;
      const maxDischargeAvailable = maxDischargeRaw * etaDis;
      fromBattH = Math.min(
        houseNeedRem,
        maxDischargeAvailable,
        remainingBattPower
      );
      const fromSocKwh = fromBattH / etaDis;
      if (useHybrid) {
        const afterChemical = fromSocKwh * etaBattDis;
        dischargeLossChemicalKwh += fromSocKwh - afterChemical;
        dischargeLossBatteryToAcKwh += afterChemical - fromBattH;
      }
      soc -= fromSocKwh / usableCapacityKwh;
      totalDischarged += fromBattH;
      sumDischargeFromSocKwh += fromSocKwh;
      dischargeLossKwh += fromSocKwh - fromBattH;
      remainingBattPower -= fromBattH;
    }
    houseNeedRem -= fromBattH;
    batteryToHouseholdKwh += fromBattH;

    let fromBattA = 0;
    if (auxNeedRem > 0 && soc > minSoc) {
      const maxDischargeRaw = (soc - minSoc) * usableCapacityKwh;
      const maxDischargeAvailable = maxDischargeRaw * etaDis;
      fromBattA = Math.min(
        auxNeedRem,
        maxDischargeAvailable,
        remainingBattPower
      );
      const fromSocKwh = fromBattA / etaDis;
      if (useHybrid) {
        const afterChemical = fromSocKwh * etaBattDis;
        dischargeLossChemicalKwh += fromSocKwh - afterChemical;
        dischargeLossBatteryToAcKwh += afterChemical - fromBattA;
      }
      soc -= fromSocKwh / usableCapacityKwh;
      totalDischarged += fromBattA;
      sumDischargeFromSocKwh += fromSocKwh;
      dischargeLossKwh += fromSocKwh - fromBattA;
      remainingBattPower -= fromBattA;
    }
    auxNeedRem -= fromBattA;
    batteryToAuxiliaryKwh += fromBattA;

    gridToHouseholdKwh += houseNeedRem;
    gridToAuxiliaryKwh += auxNeedRem;

    soc = Math.max(soc, minSoc);
    if (soc > maxSoc) soc = maxSoc;

    selfConsumptionWithStorage += directPvToHousehold + fromBattH;
    socHourly.push(soc);
  }

  const cyclesPerYear =
    usableCapacityKwh > 0 ? totalDischarged / usableCapacityKwh : 0;

  const socStartKwh = socStart * usableCapacityKwh;
  const socEndKwh = soc * usableCapacityKwh;
  const socEndPct = soc * 100;
  const energyBalanceErrorKwh =
    socEndKwh -
    socStartKwh -
    (sumChargeStoredKwh -
      sumDischargeFromSocKwh -
      totalSelfDischargeLossKwh);

  const result: BatterySimulationResult = {
    socHourly,
    totalChargedKwh: totalCharged,
    totalDischargedKwh: totalDischarged,
    cyclesPerYear,
    selfConsumptionWithStorage,
    directPvToHouseholdKwh,
    directPvToAuxiliaryKwh,
    batteryToHouseholdKwh,
    batteryToAuxiliaryKwh,
    gridToHouseholdKwh,
    gridToAuxiliaryKwh,
    gridExportKwh,
    auxiliaryConsumptionKwh,
    chargeLossKwh,
    dischargeLossKwh,
    socStartKwh,
    socEndKwh,
    socEndPct,
    energyBalanceErrorKwh,
    totalSelfDischargeLossKwh,
  };

  if (useHybrid) {
    result.chargeLossPvToBatteryKwh = chargeLossPvToBatteryKwh;
    result.chargeLossChemicalKwh = chargeLossChemicalKwh;
    result.dischargeLossChemicalKwh = dischargeLossChemicalKwh;
    result.dischargeLossBatteryToAcKwh = dischargeLossBatteryToAcKwh;
  }

  return result;
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
