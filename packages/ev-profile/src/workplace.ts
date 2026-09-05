import { EV_ENERGY_ABS_TOL_KWH } from "./constants";
import { invalidInput } from "./errors";
import type { EvModelDay, EvWorkplaceEvent, EvWorkplaceInput } from "./types";

export function workplaceIndex(k: number, W: number, n: number): number {
  return Math.floor(((2 * k + 1) * W) / (2 * n));
}

export function placeWorkplaceEvents(
  days: readonly EvModelDay[],
  workplace: EvWorkplaceInput
): EvWorkplaceEvent[] {
  if (!workplace.enabled) return [];

  const { kwhPerMonth, chargingDaysPerMonth: n } = workplace;
  if (kwhPerMonth > 0 && n <= 0) {
    throw invalidInput(
      "WORKPLACE_INVALID_DAYS",
      "workplace kWh/month > 0 requires chargingDaysPerMonth > 0",
      { kwhPerMonth, chargingDaysPerMonth: n }
    );
  }
  if (n === 0) return [];

  const events: EvWorkplaceEvent[] = [];
  for (let month = 1; month <= 12; month++) {
    const eligible = days.filter(
      (day) => day.month === month && day.dayType === "WD"
    );
    const W = eligible.length;
    if (n > W) {
      throw invalidInput(
        "WORKPLACE_DAYS_EXCEED_WEEKDAYS",
        "chargingDaysPerMonth exceeds eligible modelled weekdays in a month",
        { month, chargingDaysPerMonth: n, eligibleWeekdays: W }
      );
    }

    let assigned = 0;
    for (let k = 0; k < n; k++) {
      const idx = workplaceIndex(k, W, n);
      const selected = eligible[idx];
      if (!selected) {
        throw invalidInput(
          "WORKPLACE_DAYS_EXCEED_WEEKDAYS",
          "workplace midpoint index is outside the eligible weekday list",
          { month, k, idx, W, n }
        );
      }
      const offer =
        k === n - 1 ? kwhPerMonth - assigned : kwhPerMonth / n;
      assigned += offer;
      events.push({
        dayIndex: selected.dayIndex,
        month: selected.month,
        day: selected.day,
        offerKwh: offer,
      });
    }

    if (Math.abs(assigned - kwhPerMonth) > EV_ENERGY_ABS_TOL_KWH) {
      throw invalidInput(
        "WORKPLACE_INVALID_ENERGY",
        "monthly workplace energy residual correction failed",
        { month, assigned, kwhPerMonth }
      );
    }
  }
  return events;
}

export function workplaceOfferByDay(
  dayCount: number,
  events: readonly EvWorkplaceEvent[]
): Float64Array {
  const offers = new Float64Array(dayCount);
  for (const event of events) {
    offers[event.dayIndex] += event.offerKwh;
  }
  return offers;
}

export function declaredWorkplaceKwh(workplace: EvWorkplaceInput): number {
  if (!workplace.enabled) return 0;
  return workplace.kwhPerMonth * 12;
}
