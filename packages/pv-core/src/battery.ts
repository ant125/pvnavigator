/**
 * Battery simulation and lifecycle – verified physics.
 * Pure math, no I/O, no React.
 */

import {
  resolveBatteryPowerLimitsKw,
  type BatteryPowerLimitFields,
} from "./batteryPowerLimit";

/**
 * Default when callers omit `timeStepHours`: one simulation step = 1 hour.
 * Production SpeicherGrenze passes 0.25 explicitly via the physical kernel.
 */
export const DEFAULT_TIME_STEP_HOURS = 1;

/** Average hours per calendar month for self-discharge compounding. */
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
  /** Fraction (0–1) of stored energy lost per month via self-discharge; compounded per step. */
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
  depthOfDischarge: 1.0,
  auxiliaryPowerW: 15,
  selfDischargePerMonth: 0.01,
  efficiencyModel: "hybrid",
  ...HYBRID_EFFICIENCY_DEFAULTS,
};

/**
 * Frozen production battery physics model identifier.
 * Bump when changing efficiencies, power limits, flow priority,
 * SoC boundary treatment, self-discharge method, loss ledger definitions,
 * or the production simulation timestep.
 *
 * 1.1.0: production SpeicherGrenze uses Δt = 0.25 h (35040 steps/year).
 * Power limits and self-discharge compound per quarter-hour step.
 * Efficiencies and dispatch priority are unchanged from 1.0.0.
 */
export const BATTERY_MODEL_VERSION = "1.1.0" as const;

export type BatterySimulationHourlyOptions = {
  /**
   * When true, also return per-step charge / discharge / grid import / export.
   * Default false: `socHourly` is still always returned (existing API);
   * the extra per-step series are omitted to keep SpeicherGrenze light.
   *
   * Names remain `hourly*` for API compatibility; values are one sample per
   * simulation step, which equals one clock hour only when `timeStepHours` is 1.
   */
  includeHourly?: boolean;
  /**
   * Duration of one simulation step in hours. Default {@link DEFAULT_TIME_STEP_HOURS} (1).
   * Production SpeicherGrenze passes {@link TIME_STEP_HOURS_15} (0.25).
   * Omit to keep {@link DEFAULT_TIME_STEP_HOURS} (1) for hourly regression.
   */
  timeStepHours?: number;
};

export interface BatterySimulationResult {
  /** SoC fraction after each simulation step (name kept for API compatibility). */
  socHourly: number[];
  totalChargedKwh: number;
  totalDischargedKwh: number;
  /**
   * Energy actually added to SoC after the charge path (Σ toChargeStored).
   * Exposed for future Equivalent Full Cycles; not used by SpeicherGrenze.
   */
  totalChargedStoredKwh: number;
  /**
   * Energy withdrawn from SoC before the discharge path (Σ fromSoc).
   * Preferred numerator for future cell-level EFC; see cyclesPerYear note.
   */
  totalDischargedFromSocKwh: number;
  /**
   * Optional per-step series. Present only when `includeHourly: true`.
   * Units: kWh per simulation step (1 h when `timeStepHours` is 1).
   * Charge = AC surplus into the charge path (`toChargeRaw`);
   * discharge = AC delivered to household+aux.
   */
  hourlyChargeKwh?: number[];
  hourlyDischargeKwh?: number[];
  hourlyGridImportKwh?: number[];
  hourlyGridExportKwh?: number[];
  /**
   * AC-delivered equivalent cycles: `totalDischargedKwh / usableCapacityKwh`.
   * This is the current model metric and is **not** changed in Phase 3.
   *
   * For future cell-level Equivalent Full Cycles, prefer
   * `totalDischargedFromSocKwh / usableCapacityKwh`: energy leaving the pack
   * SoC, before η_dis. AC discharge undercounts pack throughput because
   * `fromSoc = AC / η_dis` and η_dis < 1.
   */
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
  /**
   * Auxiliary demand over the run:
   * `nSteps × (auxiliaryPowerW / 1000) × timeStepHours`.
   * At `timeStepHours = 1` and 8760 steps this is 8760 × (W / 1000).
   * At production `timeStepHours = 0.25` and 35040 steps the annual energy is the same.
   */
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
  /**
   * SOC × nominal usable envelope at simulation start
   * (0 with no reserve; equals protected backup reserve when configured, capped at maxSoc).
   */
  socStartKwh: number;
  /** SOC fraction × 100 at simulation start (same convention as `socEndPct`). */
  socStartPct: number;
  /** SOC × nominal usable envelope after the last simulation step */
  socEndKwh: number;
  /** SOC fraction × 100 (same SOC convention as per-step arrays; typical ceiling DoD×100) */
  socEndPct: number;
  /**
   * SOC ledger residual for validation (should be ~0):
   * `(socEnd − socStart) × usableCapacityKwh − (ΣΔE_in − ΣΔE_out − ΣΔE_sd)`
   * with ΔE_in = toChargeStored per step, ΔE_out = fromBattery/η_dis per step,
   * and ΣΔE_sd = totalSelfDischargeLossKwh.
   */
  energyBalanceErrorKwh: number;
  /** Σ stored energy removed by per-step self-discharge compounding. */
  totalSelfDischargeLossKwh: number;
  /** Canonical battery physics model version used for this run. */
  batteryModelVersion: typeof BATTERY_MODEL_VERSION;
}

/**
 * Run battery simulation over `loadKwh.length` steps of duration `timeStepHours`.
 * Dispatch: PV → household → auxiliary → battery charge → export;
 * deficits: battery → household, then battery → auxiliary; then grid (split).
 *
 * Production uses 35040 steps at 0.25 h; hourly 8760 / 1 h remains valid.
 * Year-length invariants live in the physical kernel / orchestrator, not here.
 */
export function calculateBatterySimulation(
  loadKwh: number[],
  pvKwh: number[],
  usableCapacityKwh: number,
  spec: BatterySpec = DEFAULT_BATTERY_SPEC,
  backupReserveKwh?: number,
  options?: BatterySimulationHourlyOptions
): BatterySimulationResult {
  const nSteps = loadKwh.length;
  const timeStepHours = options?.timeStepHours ?? DEFAULT_TIME_STEP_HOURS;
  if (
    nSteps === 0 ||
    pvKwh.length !== nSteps ||
    usableCapacityKwh <= 0 ||
    !Number.isFinite(timeStepHours) ||
    timeStepHours <= 0
  ) {
    throw new Error("Invalid inputs for battery simulation");
  }

  const reserveKwh = backupReserveKwh ?? 0;

  const collectHourly = options?.includeHourly === true;
  const socHourly = new Array<number>(nSteps);
  const hourlyChargeKwh = collectHourly ? new Array<number>(nSteps) : undefined;
  const hourlyDischargeKwh = collectHourly
    ? new Array<number>(nSteps)
    : undefined;
  const hourlyGridImportKwh = collectHourly
    ? new Array<number>(nSteps)
    : undefined;
  const hourlyGridExportKwh = collectHourly
    ? new Array<number>(nSteps)
    : undefined;
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
  const auxiliaryEnergyKwhPerStep = (auxiliaryPowerW / 1000) * timeStepHours;
  const auxiliaryConsumptionKwh = auxiliaryEnergyKwhPerStep * nSteps;

  const monthlySd = spec.selfDischargePerMonth ?? 0;
  let retentionPerHour = 1;
  if (monthlySd > 0 && monthlySd < 1) {
    retentionPerHour = Math.pow(1 - monthlySd, 1 / HOURS_PER_MONTH_AVG);
  } else if (monthlySd >= 1) {
    retentionPerHour = 0;
  }
  const retentionPerStep = Math.pow(retentionPerHour, timeStepHours);

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
  // Single source of truth: clamp reserve fraction, then derive initial energy from minSoc.
  const minSoc = Math.min(Math.max(reserveKwh / usableCapacityKwh, 0), maxSoc);
  const initialSocKwh = minSoc * usableCapacityKwh;
  let soc = minSoc;
  const socStart = soc;
  const { chargePowerKw, dischargePowerKw } =
    resolveBatteryPowerLimitsKw(usableCapacityKwh, spec);
  const maxChargeEnergyKwh = chargePowerKw * timeStepHours;
  const maxDischargeEnergyKwh = dischargePowerKw * timeStepHours;

  for (let h = 0; h < nSteps; h++) {
    const pv = pvKwh[h];
    const load = loadKwh[h];

    const energyStoredBeforeSd = soc * usableCapacityKwh;
    soc *= retentionPerStep;
    const energyStoredAfterSd = soc * usableCapacityKwh;
    totalSelfDischargeLossKwh += Math.max(
      0,
      energyStoredBeforeSd - energyStoredAfterSd
    );

    // Numerical safety only — do not replenish reserve via upward minSoc clamp.
    if (soc < 0) soc = 0;
    if (soc > maxSoc) soc = maxSoc;

    // --- PV allocation: household → auxiliary → battery charge → export ---
    let pvRem = pv;

    const directPvToHousehold = Math.min(pvRem, load);
    pvRem -= directPvToHousehold;
    directPvToHouseholdKwh += directPvToHousehold;

    const directPvToAuxiliary = Math.min(pvRem, auxiliaryEnergyKwhPerStep);
    pvRem -= directPvToAuxiliary;
    directPvToAuxiliaryKwh += directPvToAuxiliary;

    let houseNeedRem = load - directPvToHousehold;
    let auxNeedRem = auxiliaryEnergyKwhPerStep - directPvToAuxiliary;

    let toChargeRaw = 0;
    if (pvRem > 0) {
      const chargeRoom = (maxSoc - soc) * usableCapacityKwh;
      toChargeRaw = Math.min(
        pvRem,
        Math.max(0, chargeRoom),
        maxChargeEnergyKwh
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

    // --- Battery: household deficit first, then auxiliary (shared energy cap) ---
    let remainingBattEnergy = maxDischargeEnergyKwh;

    let fromBattH = 0;
    if (houseNeedRem > 0 && soc > minSoc) {
      const maxDischargeRaw = (soc - minSoc) * usableCapacityKwh;
      const maxDischargeAvailable = maxDischargeRaw * etaDis;
      fromBattH = Math.min(
        houseNeedRem,
        maxDischargeAvailable,
        remainingBattEnergy
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
      remainingBattEnergy -= fromBattH;
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
        remainingBattEnergy
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
      remainingBattEnergy -= fromBattA;
    }
    auxNeedRem -= fromBattA;
    batteryToAuxiliaryKwh += fromBattA;

    gridToHouseholdKwh += houseNeedRem;
    gridToAuxiliaryKwh += auxNeedRem;

    // Numerical safety only — do not replenish reserve via upward minSoc clamp.
    if (soc < 0) soc = 0;
    if (soc > maxSoc) soc = maxSoc;

    selfConsumptionWithStorage += directPvToHousehold + fromBattH;
    socHourly[h] = soc;

    if (collectHourly) {
      hourlyChargeKwh![h] = toChargeRaw;
      hourlyDischargeKwh![h] = fromBattH + fromBattA;
      hourlyGridImportKwh![h] = houseNeedRem + auxNeedRem;
      hourlyGridExportKwh![h] = pvRem;
    }
  }

  const cyclesPerYear =
    usableCapacityKwh > 0 ? totalDischarged / usableCapacityKwh : 0;

  const socStartKwh = initialSocKwh;
  const socStartPct = socStart * 100;
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
    totalChargedStoredKwh: sumChargeStoredKwh,
    totalDischargedFromSocKwh: sumDischargeFromSocKwh,
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
    socStartPct,
    socEndKwh,
    socEndPct,
    energyBalanceErrorKwh,
    totalSelfDischargeLossKwh,
    batteryModelVersion: BATTERY_MODEL_VERSION,
  };

  if (useHybrid) {
    result.chargeLossPvToBatteryKwh = chargeLossPvToBatteryKwh;
    result.chargeLossChemicalKwh = chargeLossChemicalKwh;
    result.dischargeLossChemicalKwh = dischargeLossChemicalKwh;
    result.dischargeLossBatteryToAcKwh = dischargeLossBatteryToAcKwh;
  }

  if (collectHourly) {
    result.hourlyChargeKwh = hourlyChargeKwh;
    result.hourlyDischargeKwh = hourlyDischargeKwh;
    result.hourlyGridImportKwh = hourlyGridImportKwh;
    result.hourlyGridExportKwh = hourlyGridExportKwh;
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
