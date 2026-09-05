import {
  EV_METHODOLOGY_SOURCE_IDS,
  EV_MODEL_VERSION,
  EV_STEPS_PER_NON_LEAP_YEAR,
  EV_TIME_STEP_HOURS,
} from "./constants";
import {
  buildEvModelDays,
  countEvDayTypes,
  evYearSlotCount,
  isLeapYear,
} from "./calendar";
import { assertEvConservation, assertEvProfileBounds } from "./invariants";
import { normalizeDrivingDistances } from "./normalize";
import { solveCyclicEvYear } from "./solver";
import { validateEvProfileInput } from "./validate";
import { countAvailableSlots, materializeHomeAvailability } from "./windows";
import {
  declaredWorkplaceKwh,
  placeWorkplaceEvents,
  workplaceOfferByDay,
} from "./workplace";
import type {
  CreateEvProfileInput,
  EvProfile15MinResult,
  EvProfileMeta,
} from "./types";

function cloneWindow(window: CreateEvProfileInput["homeWindow"]["WD"]) {
  if (window.kind === "bounded") {
    return {
      kind: "bounded" as const,
      start: { ...window.start },
      end: { ...window.end },
    };
  }
  return { kind: window.kind };
}

function cloneWindows(input: CreateEvProfileInput["homeWindow"]) {
  return {
    WD: cloneWindow(input.WD),
    SA: cloneWindow(input.SA),
    SU: cloneWindow(input.SU),
  };
}

function cloneWorkplace(input: CreateEvProfileInput["workplace"]) {
  return input.enabled
    ? {
        enabled: true as const,
        kwhPerMonth: input.kwhPerMonth,
        chargingDaysPerMonth: input.chargingDaysPerMonth,
      }
    : { enabled: false as const };
}

export function createEvProfile(input: CreateEvProfileInput): EvProfile15MinResult {
  validateEvProfileInput(input);
  const days = buildEvModelDays(input.year);
  evYearSlotCount(days);
  const dayCounts = countEvDayTypes(days);
  const normalization = normalizeDrivingDistances(
    input.annualKm,
    input.typicalDailyKm,
    days,
    dayCounts
  );
  const workplaceEvents = placeWorkplaceEvents(days, input.workplace);
  const availability = materializeHomeAvailability(days, input.homeWindow);
  const { pass, solverPasses } = solveCyclicEvYear(
    {
      dailyKm: normalization.dailyKm,
      consumptionKwhPer100Km: input.consumptionKwhPer100Km,
      usableBatteryCapacityKwh: input.usableBatteryCapacityKwh,
      maxHomeChargePowerKw: input.maxHomeChargePowerKw,
      availability,
      workplaceOfferByDay: workplaceOfferByDay(days.length, workplaceEvents),
    }
  );

  const annualDrivingDemandKwh =
    (input.annualKm * input.consumptionKwhPer100Km) / 100;
  const workplaceDeclaredKwh = declaredWorkplaceKwh(input.workplace);
  const annualHomeWindowCapacityKwh =
    countAvailableSlots(availability.mask) *
    input.maxHomeChargePowerKw *
    EV_TIME_STEP_HOURS;

  const meta: EvProfileMeta = {
    year: input.year,
    modelVersion: EV_MODEL_VERSION,
    methodologySourceIds: EV_METHODOLOGY_SOURCE_IDS,
    calendarRemap: true,
    leapDayOmitted: isLeapYear(input.year),
    timeStepHours: EV_TIME_STEP_HOURS,
    steps: EV_STEPS_PER_NON_LEAP_YEAR,
    annualKm: input.annualKm,
    consumptionKwhPer100Km: input.consumptionKwhPer100Km,
    usableBatteryCapacityKwh: input.usableBatteryCapacityKwh,
    maxHomeChargePowerKw: input.maxHomeChargePowerKw,
    windows: cloneWindows(input.homeWindow),
    workplace: cloneWorkplace(input.workplace),
    annualDrivingDemandKwh,
    drivingServedKwh: pass.drivingServedKwh,
    drivingUnservedKwh: pass.drivingUnservedKwh,
    workplaceDeclaredKwh,
    workplaceAcceptedKwh: pass.workplaceAcceptedKwh,
    workplaceRejectedKwh: pass.workplaceRejectedKwh,
    homeChargedKwh: pass.homeChargedKwh,
    annualHomeWindowCapacityKwh,
    energyStartKwh: pass.energyStartKwh,
    energyEndKwh: pass.energyEndKwh,
    impliedAnnualKmFromTypicalDistances:
      normalization.impliedAnnualKmFromTypicalDistances,
    normalizationFactor: normalization.normalizationFactor,
    impliedAnnualKmFromYearCalendar:
      normalization.impliedAnnualKmFromYearCalendar,
    yearNormalizationFactor: normalization.yearNormalizationFactor,
    dayCounts,
    solverPasses,
  };

  const result: EvProfile15MinResult = { profile: pass.profile, meta };
  assertEvConservation(result);
  assertEvProfileBounds(
    result,
    availability,
    input.maxHomeChargePowerKw,
    input.usableBatteryCapacityKwh
  );
  return result;
}
