import { EV_ENERGY_ABS_TOL_KWH, EV_ENERGY_REL_TOL } from "./constants";

export function nearlyEqual(
  a: number,
  b: number,
  absTol: number = EV_ENERGY_ABS_TOL_KWH,
  relTol: number = EV_ENERGY_REL_TOL
): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= Math.max(absTol, relTol * scale);
}

export function sumFinite(values: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i];
  }
  return total;
}
