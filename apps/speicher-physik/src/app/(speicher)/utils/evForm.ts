/**
 * EV v1 form helpers: parsing, window encoding, and mapping into
 * EvCalculationInput. No EV scheduling or feasibility math.
 *
 * Home windows use the same value-object shape as @ev-profile/loader
 * (`fullDay` / `bounded` / clock `{ hour, minute }`). The package is not
 * imported here so the calculate form stays client-safe.
 */

import type { EvCalculationInput } from "@/load/resolveEvLoadComponent";
import {
  EV_HOME_CHARGE_POWER_KW,
  type EvHomeChargePowerKw,
  type EvHomeWindowForm,
  type SpeicherInput,
} from "../types/speicher";

export const EV_FORM_COPY = {
  enableQuestion: "Elektroauto vorhanden?",
  yes: "Ja",
  no: "Nein",
  introLead:
    "Für eine realistische Berücksichtigung Ihres Elektroautos benötigen wir einige zusätzliche Angaben.",
  introEffect:
    "Diese Angaben beeinflussen die Speicherempfehlung direkt.",
  vehicleHeading: "Fahrzeug",
  annualKmQuestion: "Wie viele Kilometer fahren Sie ungefähr pro Jahr?",
  annualKmUnit: "km / Jahr",
  consumptionQuestion: "Wie hoch ist der Stromverbrauch Ihres Elektroautos?",
  consumptionUnit: "kWh / 100 km",
  consumptionHelp:
    "Den Wert finden Sie in den technischen Daten Ihres Fahrzeugs.",
  capacityQuestion:
    "Wie groß ist die nutzbare Batteriekapazität Ihres Elektroautos?",
  capacityUnit: "kWh",
  capacityHelp:
    "Den Wert finden Sie in den technischen Daten Ihres Fahrzeugs.",
  typicalHeading: "Typische Fahrstrecken",
  typicalIntro:
    "Die jährliche Fahrleistung bestimmt den Energiebedarf über das Jahr. Die folgenden Angaben beschreiben, wie sich die Fahrten über die Woche verteilen.",
  typicalWdQuestion: "Wie viele Kilometer fahren Sie an einem typischen Werktag?",
  typicalWdUnit: "km / Tag",
  typicalSaQuestion: "Wie viele Kilometer fahren Sie an einem typischen Samstag?",
  typicalSaUnit: "km",
  typicalSuQuestion: "Wie viele Kilometer fahren Sie an einem typischen Sonntag?",
  typicalSuUnit: "km",
  homeHeading: "Laden zu Hause",
  homePowerQuestion:
    "Wie schnell kann Ihr Elektroauto bei Ihnen zu Hause maximal laden?",
  homePowerHelp:
    "Bitte wählen Sie die tatsächlich mögliche Ladeleistung Ihres Fahrzeugs zu Hause.",
  homePowerTypicalNote: "11 kW – typische Wallbox",
  homeWindowQuestion:
    "Wann kann Ihr Elektroauto normalerweise zu Hause geladen werden?",
  homeWindowHelp:
    "Bitte geben Sie von und bis an. Ein Fenster über Mitternacht (zum Beispiel 17:30 bis 07:00) ist möglich. Ganztägige Verfügbarkeit muss ausdrücklich gewählt werden.",
  fullDayLabel: "Ganztägig verfügbar",
  fromLabel: "Von",
  toLabel: "Bis",
  weekdayRow: "Montag–Freitag",
  saturdayRow: "Samstag",
  sundayRow: "Sonntag",
  workplaceHeading: "Laden am Arbeitsplatz",
  workplaceQuestion:
    "Können Sie Ihr Elektroauto regelmäßig am Arbeitsplatz laden?",
  workplaceEnergyQuestion:
    "Wie viele Kilowattstunden laden Sie durchschnittlich pro Monat am Arbeitsplatz?",
  workplaceEnergyUnit: "kWh / Monat",
  workplaceEnergyHelp:
    "Den Wert finden Sie häufig in der Fahrzeug-App oder im Ladeportal Ihres Arbeitgebers.",
  workplaceDaysQuestion:
    "An wie vielen Arbeitstagen pro Monat laden Sie Ihr Elektroauto normalerweise am Arbeitsplatz?",
  workplaceDaysUnit: "Tage / Monat",
  workplaceDaysHelp:
    "Diese Angabe beschreibt, auf wie viele Arbeitstage sich die monatliche Lademenge verteilt – nicht an welchen Wochentagen Sie laden.",
} as const;

export const EV_FIELD_MESSAGES = {
  evAnnualKm: "Bitte geben Sie Ihre jährliche Fahrleistung an.",
  evConsumptionKwhPer100Km:
    "Bitte geben Sie den Stromverbrauch Ihres Elektroautos an.",
  evUsableBatteryCapacityKwh:
    "Bitte geben Sie die nutzbare Batteriekapazität an.",
  evTypicalDailyKmWd:
    "Bitte geben Sie die typische Fahrstrecke für Montag bis Freitag an.",
  evTypicalDailyKmSa:
    "Bitte geben Sie die typische Fahrstrecke für Samstag an.",
  evTypicalDailyKmSu:
    "Bitte geben Sie die typische Fahrstrecke für Sonntag an.",
  evMaxHomeChargePowerKw:
    "Bitte wählen Sie die maximale Ladeleistung zu Hause.",
  evHomeWindowWd:
    "Bitte geben Sie ein gültiges Ladefenster für Montag bis Freitag an.",
  evHomeWindowSa: "Bitte geben Sie ein gültiges Ladefenster für Samstag an.",
  evHomeWindowSu: "Bitte geben Sie ein gültiges Ladefenster für Sonntag an.",
  evWorkplaceEnabled:
    "Bitte wählen Sie, ob Sie regelmäßig am Arbeitsplatz laden können.",
  evWorkplaceKwhPerMonth:
    "Bitte geben Sie die monatliche Arbeitsplatzladung an.",
  evWorkplaceChargingDaysPerMonth:
    "Bitte geben Sie die Anzahl der Ladetage pro Monat am Arbeitsplatz an.",
} as const;

export const EV_INFEASIBLE_MESSAGE =
  "Mit den angegebenen Fahrstrecken, Ladezeiten, der Ladeleistung und der verfügbaren Fahrzeugbatterie kann der benötigte Energiebedarf nicht vollständig abgedeckt werden. Bitte prüfen Sie Ihre Angaben.";

export const EV_HOME_CHARGE_POWER_OPTIONS: ReadonlyArray<{
  kw: EvHomeChargePowerKw;
  label: string;
  note?: string;
}> = [
  { kw: 2.3, label: "2,3 kW" },
  { kw: 3.7, label: "3,7 kW" },
  { kw: 7.4, label: "7,4 kW" },
  { kw: 11, label: "11 kW", note: EV_FORM_COPY.homePowerTypicalNote },
  { kw: 22, label: "22 kW" },
];

export type EvClockValue = { hour: number; minute: number };

export type EvHomeWindowValue =
  | { kind: "unavailable" }
  | { kind: "fullDay" }
  | { kind: "bounded"; start: EvClockValue; end: EvClockValue };

const EMPTY_WINDOW: EvHomeWindowForm = {
  fullDay: false,
  start: "",
  end: "",
};

/** Clears every EV field. Used when the user switches to Nein. */
export const DISABLED_EV_FORM_FIELDS: Partial<SpeicherInput> = {
  evEnabled: false,
  evAnnualKm: undefined,
  evConsumptionKwhPer100Km: undefined,
  evUsableBatteryCapacityKwh: undefined,
  evTypicalDailyKmWd: undefined,
  evTypicalDailyKmSa: undefined,
  evTypicalDailyKmSu: undefined,
  evMaxHomeChargePowerKw: undefined,
  evHomeWindowWd: undefined,
  evHomeWindowSa: undefined,
  evHomeWindowSu: undefined,
  evWorkplaceEnabled: undefined,
  evWorkplaceKwhPerMonth: undefined,
  evWorkplaceChargingDaysPerMonth: undefined,
};

export function isEvHomeChargePowerKw(
  value: number | undefined
): value is EvHomeChargePowerKw {
  return (
    typeof value === "number" &&
    (EV_HOME_CHARGE_POWER_KW as readonly number[]).includes(value)
  );
}

/**
 * Parse a numeric form field. Digits only; German decimal comma allowed.
 * Units must not be typed.
 */
export function parseEvDecimalInput(raw: string): number | undefined {
  const s = raw.trim().replace(/ /g, "");
  if (s === "") return undefined;

  const commaCount = (s.match(/,/g) ?? []).length;
  const dotCount = (s.match(/\./g) ?? []).length;
  if (commaCount > 1 || dotCount > 1) return Number.NaN;
  if (commaCount >= 1 && dotCount >= 1) return Number.NaN;

  const normalized = commaCount === 1 ? s.replace(",", ".") : s;
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(normalized)) return Number.NaN;

  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Digits-only integer (annual km, typical km, workplace days). */
export function parseEvIntegerInput(raw: string): number | undefined {
  const s = raw.trim();
  if (s === "") return undefined;
  if (!/^\d+$/.test(s)) return Number.NaN;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function isPresentFiniteNumber(
  value: number | undefined
): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isPresentNonNegativeNumber(
  value: number | undefined
): value is number {
  return isPresentFiniteNumber(value) && value >= 0;
}

export function parseEvClockTime(raw: string): EvClockValue | null {
  const s = raw.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    (minute !== 0 && minute !== 15 && minute !== 30 && minute !== 45)
  ) {
    return null;
  }
  return { hour, minute };
}

export function clocksEqual(a: EvClockValue, b: EvClockValue): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

export function emptyHomeWindow(): EvHomeWindowForm {
  return { ...EMPTY_WINDOW };
}

export function mergeHomeWindow(
  current: EvHomeWindowForm | undefined,
  patch: Partial<EvHomeWindowForm>
): EvHomeWindowForm {
  return {
    ...(current ?? emptyHomeWindow()),
    ...patch,
  };
}

export type EvHomeWindowValidation = "ok" | "missing" | "invalid";

export function validateHomeWindowForm(
  window: EvHomeWindowForm | undefined
): EvHomeWindowValidation {
  if (window == null) return "missing";
  if (window.fullDay === true) return "ok";
  if (!window.start.trim() || !window.end.trim()) return "missing";
  const start = parseEvClockTime(window.start);
  const end = parseEvClockTime(window.end);
  if (!start || !end) return "invalid";
  if (clocksEqual(start, end)) return "invalid";
  return "ok";
}

function evClock(hour: number, minute: number): EvClockValue {
  return { hour, minute };
}

function evWindowFullDay(): EvHomeWindowValue {
  return { kind: "fullDay" };
}

function evWindowBounded(
  start: EvClockValue,
  end: EvClockValue
): EvHomeWindowValue {
  return { kind: "bounded", start, end };
}

export function mapHomeWindowForm(
  window: EvHomeWindowForm | undefined
): EvHomeWindowValue {
  if (window?.fullDay === true) {
    return evWindowFullDay();
  }
  const start = parseEvClockTime(window?.start ?? "");
  const end = parseEvClockTime(window?.end ?? "");
  if (!start || !end) {
    throw new Error("ev: home window times are missing or invalid");
  }
  return evWindowBounded(evClock(start.hour, start.minute), evClock(end.hour, end.minute));
}

/**
 * Map form state to the calculation EV input.
 * Disabled / legacy → `{ enabled: false }`. Does not invent defaults.
 */
export function mapEvFormToCalculationInput(
  input: Partial<SpeicherInput>
): EvCalculationInput {
  if (input.evEnabled !== true) {
    return { enabled: false };
  }

  const annualKm = input.evAnnualKm;
  const consumptionKwhPer100Km = input.evConsumptionKwhPer100Km;
  const usableBatteryCapacityKwh = input.evUsableBatteryCapacityKwh;
  const typicalWd = input.evTypicalDailyKmWd;
  const typicalSa = input.evTypicalDailyKmSa;
  const typicalSu = input.evTypicalDailyKmSu;
  const maxHomeChargePowerKw = input.evMaxHomeChargePowerKw;

  if (
    !isPresentFiniteNumber(annualKm) ||
    !isPresentFiniteNumber(consumptionKwhPer100Km) ||
    !isPresentFiniteNumber(usableBatteryCapacityKwh) ||
    !isPresentFiniteNumber(typicalWd) ||
    !isPresentFiniteNumber(typicalSa) ||
    !isPresentFiniteNumber(typicalSu) ||
    !isEvHomeChargePowerKw(maxHomeChargePowerKw)
  ) {
    throw new Error("ev: enabled form is missing required fields");
  }

  if (
    validateHomeWindowForm(input.evHomeWindowWd) !== "ok" ||
    validateHomeWindowForm(input.evHomeWindowSa) !== "ok" ||
    validateHomeWindowForm(input.evHomeWindowSu) !== "ok"
  ) {
    throw new Error("ev: enabled form has an invalid home window");
  }

  const workplace =
    input.evWorkplaceEnabled === true
      ? mapEnabledWorkplace(input)
      : { enabled: false as const };

  return {
    enabled: true,
    annualKm,
    consumptionKwhPer100Km,
    usableBatteryCapacityKwh,
    typicalDailyKm: {
      WD: typicalWd,
      SA: typicalSa,
      SU: typicalSu,
    },
    maxHomeChargePowerKw,
    homeWindow: {
      WD: mapHomeWindowForm(input.evHomeWindowWd),
      SA: mapHomeWindowForm(input.evHomeWindowSa),
      SU: mapHomeWindowForm(input.evHomeWindowSu),
    },
    workplace,
  };
}

function mapEnabledWorkplace(
  input: Partial<SpeicherInput>
): Extract<EvCalculationInput, { enabled: true }>["workplace"] {
  const kwhPerMonth = input.evWorkplaceKwhPerMonth;
  const chargingDaysPerMonth = input.evWorkplaceChargingDaysPerMonth;
  if (
    !isPresentFiniteNumber(kwhPerMonth) ||
    !isPresentFiniteNumber(chargingDaysPerMonth) ||
    !Number.isInteger(chargingDaysPerMonth)
  ) {
    throw new Error("ev: workplace fields are missing");
  }
  return {
    enabled: true,
    kwhPerMonth,
    chargingDaysPerMonth,
  };
}
