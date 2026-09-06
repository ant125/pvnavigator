import type { CreateEvProfileInput } from "./types";
import { evClock, evWindowBounded } from "./windows";

/**
 * Official public Methodik v1.0 reference input.
 * Used to generate docs/public/methodik/examples/ev-home-charging-profile-example.csv.
 */
export const METHODIK_EV_REFERENCE_INPUT: CreateEvProfileInput = {
  year: 2025,
  annualKm: 18000,
  consumptionKwhPer100Km: 17.5,
  usableBatteryCapacityKwh: 60,
  typicalDailyKm: { WD: 55, SA: 25, SU: 0 },
  maxHomeChargePowerKw: 11,
  homeWindow: {
    WD: evWindowBounded(evClock(17, 30), evClock(7, 0)),
    SA: evWindowBounded(evClock(10, 0), evClock(16, 0)),
    SU: evWindowBounded(evClock(10, 0), evClock(16, 0)),
  },
  workplace: {
    enabled: true,
    kwhPerMonth: 120,
    chargingDaysPerMonth: 4,
  },
};
