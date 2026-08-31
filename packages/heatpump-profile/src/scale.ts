import type { ScaleUniformEnergyResult } from "./types";
import { HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR } from "./types";

/**
 * Uniform annual electrical scaling.
 *
 * Every interval is multiplied by the same factor. The measured shape is
 * unchanged; only annual electrical energy changes. No seasonal fudge,
 * duty-cycle stretch, or weather morph.
 *
 * `scaleFactor` is `annualElectricalKwh / sum(weights)`. When the envelope
 * is unit-normalised, that equals the requested annual energy.
 */
export function scaleUniformEnergy(
  weights: readonly number[],
  annualElectricalKwh: number
): ScaleUniformEnergyResult {
  if (!Number.isFinite(annualElectricalKwh) || annualElectricalKwh <= 0) {
    throw new Error("annualElectricalKwh must be a positive finite number");
  }
  if (weights.length !== HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR) {
    throw new Error(
      `heat-pump weights length ${weights.length}, expected ${HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR}`
    );
  }

  let weightSum = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`heat-pump weight at index ${i} is invalid`);
    }
    weightSum += w;
  }
  if (!(weightSum > 0) || !Number.isFinite(weightSum)) {
    throw new Error("heat-pump weight sum must be a positive finite number");
  }

  const scaleFactor = annualElectricalKwh / weightSum;
  const profile = new Array<number>(weights.length);
  for (let i = 0; i < weights.length; i++) {
    profile[i] = weights[i] * scaleFactor;
  }
  return { profile, scaleFactor };
}
