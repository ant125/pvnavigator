import "server-only";

export type VerifiedResult = {
  energy: {
    year: {
      selfConsumptionWithoutStorage: number;
      /** Sum of hourly PVGIS profile (same run as ohne-Speicher-Bilanz), kWh/year */
      pvYieldKwhAnnual: number;
    };
  };
  /** Set when the last run used a Notstromreserve greater than 0 (kWh). */
  backupReserveKwh?: number;
};

let lastVerifiedResult: VerifiedResult | null = null;

export function getVerifiedResult(): VerifiedResult | null {
  return lastVerifiedResult;
}

export function setVerifiedResult(
  verifiedResult: VerifiedResult
): VerifiedResult {
  lastVerifiedResult = verifiedResult;
  return verifiedResult;
}
