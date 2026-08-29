/**
 * Eigenverbrauch – verified min(pv, load) aggregation over equal-length series.
 * Pure math, no I/O, no React.
 * Works for hourly (8760) and quarter-hour (35040) production grids.
 */

/**
 * Calculate yearly self-consumption without storage.
 * Formula: sum over all steps of min(pv[i], load[i]).
 */
export function calculateEigenverbrauch(
  loadKwh: number[],
  pvKwh: number[]
): number {
  if (loadKwh.length === 0 || loadKwh.length !== pvKwh.length) {
    throw new Error(
      `Profile length mismatch: load=${loadKwh.length}, pv=${pvKwh.length}`
    );
  }
  let sum = 0;
  for (let i = 0; i < loadKwh.length; i += 1) {
    sum += Math.min(pvKwh[i], loadKwh[i]);
  }
  return sum;
}

/**
 * Alias for backward compatibility.
 */
export const calculateSelfConsumptionWithoutStorage = calculateEigenverbrauch;
