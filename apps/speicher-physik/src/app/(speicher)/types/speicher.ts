/**
 * Types for the Speicher (Battery Storage) Module
 * 
 * ARCHITECTURE NOTES:
 * - This module is global (no Bavaria restriction)
 * - Shares platform with PVNavigator but has separate calculation logic
 * - Designed for future: subscription checks, paywall, PDF export
 */

/** One roof PV plane: kWp + tilt + UI azimuth (0° Nord … 359° clockwise). */
export type PvSurfaceInput = {
  systemSizeKwP: number;
  tiltDeg: number;
  azimuthDeg: number;
};

/** Explicit home-charging powers offered in the EV v1 form. */
export const EV_HOME_CHARGE_POWER_KW = [2.3, 3.7, 7.4, 11, 22] as const;

export type EvHomeChargePowerKw = (typeof EV_HOME_CHARGE_POWER_KW)[number];

/**
 * Form encoding of a home-availability window.
 * Full-day must be explicit. `start === end` is not 24 hours.
 * Times are `HH:MM` on the 15-minute grid.
 */
export type EvHomeWindowForm = {
  fullDay: boolean;
  start: string;
  end: string;
};

/**
 * Input data for Speicher calculation
 */
export interface SpeicherInput {
  /**
   * Optional multi-roof planes. When present and non-empty, these are source of truth
   * for PV. Otherwise use pvSizeKwp + tilt + azimuth (legacy single-roof form).
   */
  pvSurfaces?: PvSurfaceInput[];

  /** PV system size in kWp */
  pvSizeKwp: number;
  
  /** Building street name (for geocoding / irradiance estimation) */
  street: string;

  /** Building house number */
  houseNumber: string;

  /** German postal code (PLZ) */
  postalCode: string;

  /** City / municipality */
  city: string;
  
  /** Roof azimuth in whole degrees clockwise from North, 0–359 (0° = N, 90° = E, 180° = S, 270° = W). */
  azimuth: number;
  
  /** Roof tilt angle in degrees (0° = flat, 90° = vertical) */
  tilt: number;
  
  /** Annual electricity consumption in kWh */
  annualConsumptionKwh: number;

  /** Optional: heat pump present */
  heatPumpEnabled?: boolean;

  /** Optional: annual heat pump electricity consumption (kWh) */
  heatPumpConsumptionKwh?: number;

  /**
   * Production technology. The new UI allows Luft/Wasser and Wasser/Wasser
   * (heating + DHW only for Wasser/Wasser). Absent on legacy saved calculations.
   */
  heatPumpTechnology?: "luftwasser" | "wasserwasser";

  /**
   * Whether the heat pump also supplies domestic hot water.
   * Required by the new UI when a heat pump is enabled; absent on legacy
   * saved calculations.
   */
  heatPumpDhwService?: "space_heat_only" | "space_heat_and_dhw";

  /** Optional: electric vehicle present. Default/legacy is absent or false. */
  evEnabled?: boolean;

  /** Annual driving distance (km / year). No hidden default. */
  evAnnualKm?: number;

  /** Vehicle electricity consumption (kWh / 100 km). */
  evConsumptionKwhPer100Km?: number;

  /** Usable EV battery capacity (kWh), not gross capacity. */
  evUsableBatteryCapacityKwh?: number;

  /** Typical Monday–Friday driving distance (km / day). */
  evTypicalDailyKmWd?: number;

  /** Typical Saturday driving distance (km). */
  evTypicalDailyKmSa?: number;

  /** Typical Sunday driving distance (km). */
  evTypicalDailyKmSu?: number;

  /**
   * Maximum effective home charging power (kW).
   * Must be one of the explicit UI values: 2.3, 3.7, 7.4, 11, 22.
   */
  evMaxHomeChargePowerKw?: EvHomeChargePowerKw;

  evHomeWindowWd?: EvHomeWindowForm;
  evHomeWindowSa?: EvHomeWindowForm;
  evHomeWindowSu?: EvHomeWindowForm;

  /** Workplace charging. Required true/false when EV is enabled. */
  evWorkplaceEnabled?: boolean;

  evWorkplaceKwhPerMonth?: number;
  evWorkplaceChargingDaysPerMonth?: number;

  /** Optional: energy held as backup reserve (Notstrom), not used in daily cycling (kWh) */
  backupReserveKwh?: number;
  
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

