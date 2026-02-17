import "server-only";

export type VerifiedResult = {
  energy: {
    year: {
      selfConsumptionWithoutStorage: number;
    };
  };
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
