/**
 * Types for the Speicher (Battery Storage) Module
 * 
 * ARCHITECTURE NOTES:
 * - This module is global (no Bavaria restriction)
 * - Shares platform with PVNavigator but has separate calculation logic
 * - Designed for future: subscription checks, paywall, PDF export
 */

/**
 * Input data for Speicher calculation
 */
export interface SpeicherInput {
  /** PV system size in kWp */
  pvSizeKwp: number;
  
  /** Location address (for irradiance estimation) */
  address: string;
  
  /** Roof azimuth angle in degrees (0° = North, 90° = East, 180° = South, 270° = West) */
  azimuth: number;
  
  /** Roof tilt angle in degrees (0° = flat, 90° = vertical) */
  tilt: number;
  
  /** Annual electricity consumption in kWh */
  annualConsumptionKwh: number;
  
  /** User knows battery prices (optional checkbox) */
  hasCustomPrices: boolean;
  
  /** Optional: Custom price for 5 kWh battery (EUR) */
  customPrice5kWh?: number;
  
  /** Optional: Custom price for 7.5 kWh battery (EUR) */
  customPrice7_5kWh?: number;
  
  /** Optional: Custom price for 10 kWh battery (EUR) */
  customPrice10kWh?: number;
  
  /** @deprecated Use hasCustomPrices instead */
  hasExistingQuote?: boolean;
  
  /** @deprecated Use customPrice* fields instead */
  quotePrice?: number;
}

/**
 * Result of Speicher calculation
 */
export interface SpeicherResult {
  /** Recommended battery size in kWh */
  recommendedSizeKwh: number;
  
  /** Self-consumption rate without battery (%) */
  selfConsumptionWithout: number;
  
  /** Self-consumption rate with battery (%) */
  selfConsumptionWith: number;
  
  /** Annual savings in EUR */
  annualSavingsEur: number;
  
  /** Estimated battery cost in EUR */
  estimatedCostEur: number;
  
  /** Payback period in years */
  paybackYears: number;
  
  /** Is the investment economically viable? */
  isViable: boolean;
  
  /** Recommendation text */
  recommendation: string;
}

/**
 * Battery size option for selection
 */
export interface BatterySizeOption {
  sizeKwh: number;
  label: string;
  priceEstimateEur: number;
}

/**
 * Standard battery size options
 */
export const BATTERY_SIZE_OPTIONS: BatterySizeOption[] = [
  { sizeKwh: 5, label: "5 kWh", priceEstimateEur: 3200 },
  { sizeKwh: 7.5, label: "7,5 kWh", priceEstimateEur: 4000 },
  { sizeKwh: 10, label: "10 kWh", priceEstimateEur: 4800 },
  { sizeKwh: 12, label: "12 kWh", priceEstimateEur: 5800 },
  { sizeKwh: 15, label: "15 kWh", priceEstimateEur: 7000 },
];

/**
 * Economic parameters for calculation
 * Can be adjusted based on market conditions
 */
export const ECONOMIC_PARAMS = {
  /** Current electricity price in EUR/kWh */
  electricityPriceEurKwh: 0.32,
  
  /** Feed-in tariff in EUR/kWh */
  feedInTariffEurKwh: 0.082,
  
  /** Annual electricity price increase (%) */
  annualPriceIncrease: 0.03,
  
  /** Battery degradation per year (%) */
  annualDegradation: 0.02,
  
  /** Expected battery lifetime (years) */
  batteryLifetimeYears: 15,
  
  /** Discount rate for NPV calculation */
  discountRate: 0.03,
} as const;

