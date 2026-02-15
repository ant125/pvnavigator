/**
 * Eigenverbrauch – verified hourly min(pv, load) aggregation.
 * Pure math, no I/O, no React.
 */

const HOURS_PER_YEAR = 8760;

/**
 * Calculate yearly self-consumption without storage.
 * Formula: sum over 8760h of min(pv[h], load[h]).
 */
export function calculateEigenverbrauch(
  loadKwh: number[],
  pvKwh: number[]
): number {
  if (loadKwh.length !== HOURS_PER_YEAR || pvKwh.length !== HOURS_PER_YEAR) {
    throw new Error(
      `Profile length mismatch: load=${loadKwh.length}, pv=${pvKwh.length}`
    );
  }
  let sum = 0;
  for (let i = 0; i < HOURS_PER_YEAR; i += 1) {
    sum += Math.min(pvKwh[i], loadKwh[i]);
  }
  return sum;
}

/**
 * Alias for backward compatibility.
 */
export const calculateSelfConsumptionWithoutStorage = calculateEigenverbrauch;
