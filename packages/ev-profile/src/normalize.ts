import {
  EV_ENERGY_ABS_TOL_KWH,
  EV_REFERENCE_SA_DAYS,
  EV_REFERENCE_SU_DAYS,
  EV_REFERENCE_WD_DAYS,
} from "./constants";
import { invalidInput } from "./errors";
import type { EvDayCounts, EvModelDay, EvTypicalDailyKm } from "./types";

export type EvNormalization = {
  dailyKm: number[];
  impliedAnnualKmFromTypicalDistances: number;
  normalizationFactor: number | null;
  impliedAnnualKmFromYearCalendar: number;
  yearNormalizationFactor: number | null;
};

export function impliedAnnualKmFromTypicalDistances(
  typical: EvTypicalDailyKm
): number {
  return (
    EV_REFERENCE_WD_DAYS * typical.WD +
    EV_REFERENCE_SA_DAYS * typical.SA +
    EV_REFERENCE_SU_DAYS * typical.SU
  );
}

export function impliedAnnualKmFromYearCalendar(
  typical: EvTypicalDailyKm,
  dayCounts: EvDayCounts
): number {
  return (
    dayCounts.WD * typical.WD +
    dayCounts.SA * typical.SA +
    dayCounts.SU * typical.SU
  );
}

/**
 * Annual km are authoritative. Typical WD/SA/SU distances are scaled by
 * s(Y) = annualKm / Dimp(Y). The last modelled day absorbs only the
 * floating-point residual so sum(dailyKm) == annualKm.
 */
export function normalizeDrivingDistances(
  annualKm: number,
  typical: EvTypicalDailyKm,
  days: readonly EvModelDay[],
  dayCounts: EvDayCounts
): EvNormalization {
  const impliedRef = impliedAnnualKmFromTypicalDistances(typical);
  const dimp = impliedAnnualKmFromYearCalendar(typical, dayCounts);
  const normalizationFactor = impliedRef === 0 ? null : annualKm / impliedRef;

  if (annualKm === 0) {
    return {
      dailyKm: days.map(() => 0),
      impliedAnnualKmFromTypicalDistances: impliedRef,
      normalizationFactor,
      impliedAnnualKmFromYearCalendar: dimp,
      yearNormalizationFactor: dimp === 0 ? null : 0,
    };
  }

  if (!(dimp > 0)) {
    throw invalidInput(
      "MISSING_TEMPORAL_SHAPE",
      "annual km > 0 requires a non-zero WD/SA/SU typical-distance shape",
      { annualKm, typical, dimp }
    );
  }

  const scale = annualKm / dimp;
  const dailyKm = days.map((day) => scale * typical[day.dayType]);
  let total = 0;
  for (let i = 0; i < dailyKm.length; i++) total += dailyKm[i];
  dailyKm[dailyKm.length - 1] += annualKm - total;

  let check = 0;
  for (let i = 0; i < dailyKm.length; i++) check += dailyKm[i];
  if (Math.abs(check - annualKm) > EV_ENERGY_ABS_TOL_KWH) {
    throw invalidInput(
      "INVALID_ANNUAL_KM",
      "daily-km residual correction failed to recover annual km",
      { annualKm, recovered: check }
    );
  }

  return {
    dailyKm,
    impliedAnnualKmFromTypicalDistances: impliedRef,
    normalizationFactor,
    impliedAnnualKmFromYearCalendar: dimp,
    yearNormalizationFactor: scale,
  };
}
