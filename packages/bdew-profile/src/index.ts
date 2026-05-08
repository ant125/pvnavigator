/**
 * BDEW H0 Profile – loads and scales hourly consumption profile.
 * Pure module: no fs / filesystem access. Safe in serverless environments.
 * Single source of truth for household load (8760h).
 * Do not import in client components – use @bdew-profile/loader/chart for UI.
 */

import { BDEW_H0 } from "./bdew_h0";

export type HourlyRow = {
  kWh: number;
};

export type BdewProfileKey = "H0";

const BDEW_REFERENCE_GWH = 1_000_000;

/**
 * Load raw hourly weights from BDEW profile (8760h).
 * Values are for 1 GWh reference (sum ≈ 1e6).
 */
export function loadBDEWProfileHourlies(
  profileKey: BdewProfileKey = "H0"
): number[] {
  if (profileKey !== "H0") {
    throw new Error(`Unsupported BDEW profile: ${profileKey}`);
  }

  if (BDEW_H0.length !== 8760) {
    throw new Error(`BDEW H0 profile length mismatch: ${BDEW_H0.length}`);
  }

  return BDEW_H0;
}

/**
 * Scale hourly weights to annual consumption.
 * hourlyWeights: raw from loadBDEWProfileHourlies (sum ≈ 1e6 for 1 GWh)
 */
export function scaleToAnnualKWh(
  hourlyWeights: number[],
  annualKWh: number
): number[] {
  const scaleFactor = annualKWh / BDEW_REFERENCE_GWH;
  return hourlyWeights.map((w) => w * scaleFactor);
}

export function loadBDEWH0Profile(): HourlyRow[] {
  const weights = loadBDEWProfileHourlies("H0");
  return weights.map((kWh) => ({ kWh }));
}

export function createUserLoadProfile(annualConsumptionKWh: number): number[] {
  const weights = loadBDEWProfileHourlies("H0");
  return scaleToAnnualKWh(weights, annualConsumptionKWh);
}
