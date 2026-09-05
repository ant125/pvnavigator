import {
  evClock,
  evWindowBounded,
  evWindowFullDay,
  evWindowUnavailable,
} from "@ev-profile/loader";
import type { EvCalculationInput } from "@/load/resolveEvLoadComponent";

export function commuterEvInput(
  overrides: Partial<Extract<EvCalculationInput, { enabled: true }>> = {}
): Extract<EvCalculationInput, { enabled: true }> {
  return {
    enabled: true,
    annualKm: 15000,
    consumptionKwhPer100Km: 18,
    usableBatteryCapacityKwh: 60,
    typicalDailyKm: { WD: 40, SA: 20, SU: 10 },
    maxHomeChargePowerKw: 11,
    homeWindow: {
      WD: evWindowBounded(evClock(18, 0), evClock(7, 0)),
      SA: evWindowFullDay(),
      SU: evWindowBounded(evClock(10, 0), evClock(20, 0)),
    },
    workplace: { enabled: true, kwhPerMonth: 80, chargingDaysPerMonth: 8 },
    ...overrides,
  };
}

export function infeasibleEvInput(): Extract<
  EvCalculationInput,
  { enabled: true }
> {
  return commuterEvInput({
    usableBatteryCapacityKwh: 1,
    maxHomeChargePowerKw: 0,
    workplace: { enabled: false },
    homeWindow: {
      WD: evWindowUnavailable(),
      SA: evWindowUnavailable(),
      SU: evWindowUnavailable(),
    },
  });
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) total += values[i];
  return total;
}
