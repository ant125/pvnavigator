import { describe, expect, it } from "vitest";
import { scaleUniformEnergy } from "../src/scale";
import { HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR } from "../src/types";

const ANNUAL_SUM_REL_TOL = 1e-12;

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function unitWeights(nonzero: Array<[number, number]>): number[] {
  const weights = new Array<number>(HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR).fill(0);
  for (const [index, value] of nonzero) {
    weights[index] = value;
  }
  return weights;
}

describe("scaleUniformEnergy", () => {
  it("scales unit weights so the annual sum equals the request", () => {
    const weights = unitWeights([
      [0, 0.25],
      [100, 0.75],
    ]);
    const { profile, scaleFactor } = scaleUniformEnergy(weights, 4000);
    expect(profile).toHaveLength(HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR);
    expect(scaleFactor).toBe(4000);
    expect(profile[0]).toBe(1000);
    expect(profile[100]).toBe(3000);
    expect(Math.abs(sum(profile) - 4000)).toBeLessThanOrEqual(
      4000 * ANNUAL_SUM_REL_TOL
    );
  });

  it("preserves shape: every slot shares the same scale factor", () => {
    const weights = unitWeights([
      [10, 0.1],
      [20, 0.3],
      [30, 0.6],
    ]);
    const { profile, scaleFactor } = scaleUniformEnergy(weights, 2500);
    for (let i = 0; i < weights.length; i++) {
      expect(profile[i]).toBe(weights[i] * scaleFactor);
    }
    expect(profile[20] / profile[10]).toBeCloseTo(3, 12);
    expect(profile[30] / profile[10]).toBeCloseTo(6, 12);
  });

  it("is deterministic", () => {
    const weights = unitWeights([[0, 1]]);
    const a = scaleUniformEnergy(weights, 1234.5);
    const b = scaleUniformEnergy(weights, 1234.5);
    expect(a.scaleFactor).toBe(b.scaleFactor);
    expect(a.profile).toEqual(b.profile);
  });

  it("does not mutate the input weights", () => {
    const weights = unitWeights([[0, 1]]);
    const before = weights[0];
    scaleUniformEnergy(weights, 800);
    expect(weights[0]).toBe(before);
  });

  it("uses the actual weight sum, not a second reference energy", () => {
    const weights = unitWeights([[0, 2]]);
    const { profile, scaleFactor } = scaleUniformEnergy(weights, 100);
    expect(scaleFactor).toBe(50);
    expect(profile[0]).toBe(100);
    expect(Math.abs(sum(profile) - 100)).toBeLessThanOrEqual(
      100 * ANNUAL_SUM_REL_TOL
    );
  });

  it("rejects non-positive annual energy", () => {
    const weights = unitWeights([[0, 1]]);
    expect(() => scaleUniformEnergy(weights, 0)).toThrow(/positive finite/);
    expect(() => scaleUniformEnergy(weights, -1)).toThrow(/positive finite/);
    expect(() => scaleUniformEnergy(weights, Number.NaN)).toThrow(
      /positive finite/
    );
  });

  it("rejects the wrong series length", () => {
    expect(() => scaleUniformEnergy([1, 0, 0], 100)).toThrow(/length/);
  });
});
