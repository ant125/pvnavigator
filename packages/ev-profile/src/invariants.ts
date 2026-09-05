import {
  EV_ENERGY_ABS_TOL_KWH,
  EV_STEPS_PER_NON_LEAP_YEAR,
  EV_TIME_STEP_HOURS,
} from "./constants";
import { infeasible } from "./errors";
import { nearlyEqual, sumFinite } from "./numeric";
import type { EvAvailability, EvProfile15MinResult } from "./types";

export function assertEvConservation(
  result: EvProfile15MinResult,
  absTol: number = EV_ENERGY_ABS_TOL_KWH
): void {
  const { meta, profile } = result;
  const workplaceSplit = nearlyEqual(
    meta.workplaceDeclaredKwh,
    meta.workplaceAcceptedKwh + meta.workplaceRejectedKwh,
    absTol
  );
  const drivingSplit = nearlyEqual(
    meta.annualDrivingDemandKwh,
    meta.drivingServedKwh + meta.drivingUnservedKwh,
    absTol
  );
  const vehicleIdentity = nearlyEqual(
    meta.energyEndKwh - meta.energyStartKwh,
    meta.workplaceAcceptedKwh + meta.homeChargedKwh - meta.drivingServedKwh,
    absTol
  );
  const cyclic = nearlyEqual(
    meta.energyEndKwh,
    meta.energyStartKwh,
    absTol
  );
  const cyclicEnergy = nearlyEqual(
    meta.homeChargedKwh + meta.workplaceAcceptedKwh,
    meta.drivingServedKwh,
    absTol
  );

  if (!workplaceSplit || !drivingSplit || !vehicleIdentity) {
    throw infeasible(
      "CONSERVATION_BROKEN",
      "EV energy ledger identities do not hold",
      { meta }
    );
  }
  if (!cyclic || !cyclicEnergy) {
    throw infeasible(
      "CONSERVATION_BROKEN",
      "converged EV year is not cyclic within numerical tolerance",
      { meta }
    );
  }
  if (!nearlyEqual(sumFinite(profile), meta.homeChargedKwh, absTol)) {
    throw infeasible(
      "CONSERVATION_BROKEN",
      "profile sum must equal homeChargedKwh",
      {
        profileSum: sumFinite(profile),
        homeChargedKwh: meta.homeChargedKwh,
      }
    );
  }
}

export function assertEvProfileBounds(
  result: EvProfile15MinResult,
  availability: EvAvailability,
  maxHomeChargePowerKw: number,
  capacity: number
): void {
  const { profile, meta } = result;
  if (profile.length !== EV_STEPS_PER_NON_LEAP_YEAR) {
    throw infeasible(
      "NON_FINITE_PROFILE",
      `EV profile length must be ${EV_STEPS_PER_NON_LEAP_YEAR}`,
      { length: profile.length }
    );
  }
  const maxSlot = maxHomeChargePowerKw * EV_TIME_STEP_HOURS;
  for (let i = 0; i < profile.length; i++) {
    const value = profile[i];
    if (!Number.isFinite(value)) {
      throw infeasible("NON_FINITE_PROFILE", "EV profile contains a non-finite value", {
        index: i,
        value,
      });
    }
    if (value < 0) {
      throw infeasible("NON_FINITE_PROFILE", "EV profile contains a negative value", {
        index: i,
        value,
      });
    }
    if (value > 0 && !availability.mask[i]) {
      throw infeasible(
        "HOME_CHARGE_OUTSIDE_WINDOW",
        "home charging written outside the availability mask",
        { index: i, value }
      );
    }
    if (value > maxSlot + EV_ENERGY_ABS_TOL_KWH) {
      throw infeasible(
        "HOME_CHARGE_EXCEEDS_POWER",
        "home slot energy exceeds maxHomeChargePowerKw × 0.25",
        { index: i, value, maxSlot }
      );
    }
  }
  if (
    meta.energyStartKwh < -EV_ENERGY_ABS_TOL_KWH ||
    meta.energyEndKwh < -EV_ENERGY_ABS_TOL_KWH ||
    meta.energyStartKwh > capacity + EV_ENERGY_ABS_TOL_KWH ||
    meta.energyEndKwh > capacity + EV_ENERGY_ABS_TOL_KWH
  ) {
    throw infeasible(
      "VEHICLE_ENERGY_OUT_OF_BOUNDS",
      "reported EV start/end energy left [0, capacity]",
      {
        energyStartKwh: meta.energyStartKwh,
        energyEndKwh: meta.energyEndKwh,
        capacity,
      }
    );
  }
}
