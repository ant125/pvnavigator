/**
 * Seasonal heat-pump electricity profile.
 *
 * Hourly production path: 8760 steps (unchanged).
 * Alternate 15-min path: 35040 steps with the same monthly multipliers
 * and the same annual kWh. Not wired to calculateSpeicherResult.
 */

import {
  STEPS_PER_DAY_15,
  STEPS_PER_NON_LEAP_YEAR_15,
} from "../../../../packages/pv-core";
import type { LoadComponent } from "./merge";

const HOURS_PER_YEAR = 8760;

const NON_LEAP_MONTH_DAYS = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
] as const;

const HOURS_PER_MONTH = NON_LEAP_MONTH_DAYS.map((d) => d * 24);
const QUARTER_HOURS_PER_MONTH = NON_LEAP_MONTH_DAYS.map(
  (d) => d * STEPS_PER_DAY_15
);

function monthFromHourIndex(idx: number): number {
  let h = idx;
  for (let m = 0; m < 12; m++) {
    const block = HOURS_PER_MONTH[m];
    if (h < block) return m;
    h -= block;
  }
  throw new Error(`heatPump: hour index out of range: ${idx}`);
}

function monthFromQuarterHourIndex(idx: number): number {
  let s = idx;
  for (let m = 0; m < 12; m++) {
    const block = QUARTER_HOURS_PER_MONTH[m];
    if (s < block) return m;
    s -= block;
  }
  throw new Error(`heatPump: quarter-hour index out of range: ${idx}`);
}

function seasonalMultiplier(month: number): number {
  if (month === 10 || month === 11 || month <= 2) return 1.65;
  if (month >= 5 && month <= 7) return 0.42;
  return 1.0;
}

function buildHeatPumpHourlyWeights(): number[] {
  const w = new Array<number>(HOURS_PER_YEAR);
  for (let h = 0; h < HOURS_PER_YEAR; h++) {
    w[h] = seasonalMultiplier(monthFromHourIndex(h));
  }
  return w;
}

function buildHeatPumpQuarterHourWeights(): number[] {
  const w = new Array<number>(STEPS_PER_NON_LEAP_YEAR_15);
  for (let i = 0; i < STEPS_PER_NON_LEAP_YEAR_15; i++) {
    w[i] = seasonalMultiplier(monthFromQuarterHourIndex(i));
  }
  return w;
}

function scaleWeightsToAnnual(
  weights: number[],
  annualKWh: number,
  fnName: string
): number[] {
  if (!Number.isFinite(annualKWh) || annualKWh <= 0) {
    throw new Error(`${fnName}: annualKWh must be a positive finite number`);
  }
  const sumW = weights.reduce((a, b) => a + b, 0);
  const scale = annualKWh / sumW;
  return weights.map((x) => x * scale);
}

/**
 * @param annualKWh — annual electricity consumption attributed to the heat pump
 */
export function createHeatPumpComponent(annualKWh: number): LoadComponent {
  const profile = scaleWeightsToAnnual(
    buildHeatPumpHourlyWeights(),
    annualKWh,
    "createHeatPumpComponent"
  );

  return {
    name: "heatPump",
    yearlyConsumption: annualKWh,
    profile,
  };
}

/**
 * Same seasonal model as {@link createHeatPumpComponent}, native 96 slots/day.
 * Not used by SpeicherGrenze production (still hourly).
 */
export function createHeatPumpComponent15Min(annualKWh: number): LoadComponent {
  const profile = scaleWeightsToAnnual(
    buildHeatPumpQuarterHourWeights(),
    annualKWh,
    "createHeatPumpComponent15Min"
  );

  return {
    name: "heatPump",
    yearlyConsumption: annualKWh,
    profile,
  };
}
