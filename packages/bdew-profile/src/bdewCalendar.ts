/**
 * Canonical Europe/Berlin day classification for household BDEW and EV.
 *
 * Weekday public holidays are not remapped. Leap years omit 29 February
 * so the series stays on the non-leap 365-day / 35 040-step grid.
 *
 * This file must stay free of profile-template data so EV can reuse the
 * calendar without loading H0 / H25 arrays.
 */

export type BdewDayType = "WD" | "SA" | "SU";

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Civil days in the 8760h / 35040-step series: full year minus Feb 29 when leap
 * (matches PVGIS non-leap normalization).
 */
export function* iterateBdewProfileDays(
  year: number
): Generator<{ month: number; day: number }> {
  const leap = isLeapYear(year);
  const monthLengths = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= monthLengths[m]; d++) {
      if (leap && m === 1 && d === 29) continue;
      yield { month: m + 1, day: d };
    }
  }
}

/** Weekday class in Europe/Berlin: WD / SA / SU. Does not remap public holidays. */
export function classifyBdewDayTypeEuropeBerlin(
  year: number,
  month: number,
  day: number
): BdewDayType {
  const ms = Date.UTC(year, month - 1, day, 12, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (wd === "Sat") return "SA";
  if (wd === "Sun") return "SU";
  return "WD";
}
