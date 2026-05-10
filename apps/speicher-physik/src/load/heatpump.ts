/**
 * Seasonal heat-pump electricity profile (8760h, non–leap year alignment).
 * Higher relative load in winter; lower in summer — illustrative shape only.
 */

import type { LoadComponent } from "./merge";

const HOURS_PER_YEAR = 8760;

const HOURS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31].map(
  (d) => d * 24
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

/**
 * @param annualKWh — annual electricity consumption attributed to the heat pump
 */
export function createHeatPumpComponent(annualKWh: number): LoadComponent {
  if (!Number.isFinite(annualKWh) || annualKWh <= 0) {
    throw new Error("createHeatPumpComponent: annualKWh must be a positive finite number");
  }

  const weights = buildHeatPumpHourlyWeights();
  const sumW = weights.reduce((a, b) => a + b, 0);
  const scale = annualKWh / sumW;
  const profile = weights.map((x) => x * scale);

  return {
    name: "heatPump",
    yearlyConsumption: annualKWh,
    profile,
  };
}
