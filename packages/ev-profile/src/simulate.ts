import {
  EV_ENERGY_ABS_TOL_KWH,
  EV_SLOTS_PER_DAY,
  EV_STEPS_PER_NON_LEAP_YEAR,
  EV_TIME_STEP_HOURS,
} from "./constants";
import { infeasible } from "./errors";
import type { EvAvailability, EvYearPass } from "./types";

export type SimulateEvYearInput = {
  dailyKm: readonly number[];
  consumptionKwhPer100Km: number;
  usableBatteryCapacityKwh: number;
  maxHomeChargePowerKw: number;
  availability: EvAvailability;
  workplaceOfferByDay: ArrayLike<number>;
  energyStartKwh: number;
};

function assertVehicleBounds(
  energy: number,
  capacity: number,
  context: string
): void {
  if (
    energy < -EV_ENERGY_ABS_TOL_KWH ||
    energy > capacity + EV_ENERGY_ABS_TOL_KWH
  ) {
    throw infeasible(
      "VEHICLE_ENERGY_OUT_OF_BOUNDS",
      `EV vehicle energy left [0, capacity] (${context})`,
      { energy, capacity, context }
    );
  }
}

/**
 * One complete target-year pass. Driving and workplace are abstract
 * energy-state transitions at the day's event boundary; only home charging
 * is written onto the 15-minute profile.
 */
export function simulateEvYearPass(input: SimulateEvYearInput): EvYearPass {
  const {
    dailyKm,
    consumptionKwhPer100Km,
    usableBatteryCapacityKwh: capacity,
    maxHomeChargePowerKw,
    availability,
    workplaceOfferByDay,
    energyStartKwh,
  } = input;

  const maxSlotKwh = maxHomeChargePowerKw * EV_TIME_STEP_HOURS;
  const profile = new Array<number>(EV_STEPS_PER_NON_LEAP_YEAR).fill(0);
  let energy = energyStartKwh;
  let drivingServedKwh = 0;
  let drivingUnservedKwh = 0;
  let workplaceAcceptedKwh = 0;
  let workplaceRejectedKwh = 0;
  let homeChargedKwh = 0;
  let minEnergyKwh = energy;
  let maxEnergyKwh = energy;

  assertVehicleBounds(energy, capacity, "start");

  const applyDrive = (demand: number): void => {
    const served = Math.min(energy, demand);
    const unserved = demand - served;
    energy -= served;
    drivingServedKwh += served;
    drivingUnservedKwh += unserved;
    assertVehicleBounds(energy, capacity, "after driving");
  };

  const applyWorkplace = (offer: number): void => {
    const free = Math.max(0, capacity - energy);
    const accepted = Math.min(free, offer);
    const rejected = offer - accepted;
    energy += accepted;
    workplaceAcceptedKwh += accepted;
    workplaceRejectedKwh += rejected;
    assertVehicleBounds(energy, capacity, "after workplace");
  };

  const applyHome = (slotIndex: number): number => {
    if (!availability.mask[slotIndex]) return 0;
    const free = Math.max(0, capacity - energy);
    const home = Math.min(free, maxSlotKwh);
    energy += home;
    homeChargedKwh += home;
    profile[slotIndex] = home;
    assertVehicleBounds(energy, capacity, "after home charging");
    return home;
  };

  for (let dayIndex = 0; dayIndex < dailyKm.length; dayIndex++) {
    const demand = (dailyKm[dayIndex] * consumptionKwhPer100Km) / 100;
    const offer = workplaceOfferByDay[dayIndex] ?? 0;
    const eventSlot = availability.eventBoundarySlot[dayIndex];
    const offset = dayIndex * EV_SLOTS_PER_DAY;

    for (let slot = 0; slot < EV_SLOTS_PER_DAY; slot++) {
      if (slot === eventSlot) {
        applyDrive(demand);
        applyWorkplace(offer);
      }
      applyHome(offset + slot);
      if (energy < minEnergyKwh) minEnergyKwh = energy;
      if (energy > maxEnergyKwh) maxEnergyKwh = energy;
    }
  }

  return {
    profile,
    energyStartKwh,
    energyEndKwh: energy,
    drivingServedKwh,
    drivingUnservedKwh,
    workplaceAcceptedKwh,
    workplaceRejectedKwh,
    homeChargedKwh,
    minEnergyKwh,
    maxEnergyKwh,
  };
}
