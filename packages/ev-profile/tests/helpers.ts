import type { CreateEvProfileInput } from "../src/index";
import {
  evClock,
  evWindowBounded,
  evWindowFullDay,
  evWindowUnavailable,
} from "../src/index";

export function commuterInput(
  overrides: Partial<CreateEvProfileInput> = {}
): CreateEvProfileInput {
  return {
    year: 2018,
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

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function profileFingerprint(profile: readonly number[]): string {
  let hash = 2166136261;
  for (let i = 0; i < profile.length; i++) {
    hash ^= Math.round(profile[i] * 1e9);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export { evClock, evWindowBounded, evWindowFullDay, evWindowUnavailable };
