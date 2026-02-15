/**
 * Multi-year aggregation layer – 15-year economic comparison.
 * Pure math, no I/O, no React.
 */

export interface MultiYearScenario {
  year: number;
  selfConsumptionKwh: number;
  gridImportKwh: number;
  feedInKwh: number;
  savingsEur: number;
}

export interface MultiYearAggregationResult {
  scenarios: MultiYearScenario[];
  totalSavingsEur: number;
  npvEur: number;
}

/**
 * Placeholder for 15-year aggregation.
 * To be implemented when economic params and degradation are defined.
 */
export function calculateMultiYearAggregation(
  _annualSelfConsumptionKwh: number,
  _annualGridImportKwh: number,
  _annualFeedInKwh: number,
  _years: number = 15
): MultiYearAggregationResult {
  return {
    scenarios: [],
    totalSavingsEur: 0,
    npvEur: 0,
  };
}
