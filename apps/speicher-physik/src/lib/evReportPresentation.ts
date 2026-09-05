/**
 * Result/report presentation for SpeicherGrenze EV v1.
 * Reads typed EvCalculationMeta only. No EV physics, no form-state fallback.
 */

import type {
  EvCalculationMeta,
  EvHomeWindow,
  EvProfileMeta,
} from "@/load/resolveEvLoadComponent";

export type EvReportInputRow = {
  label: string;
  value: string;
};

export type EvReportDerivedRow = {
  label: string;
  valueKwh: number;
  note?: string;
};

export type EvReportView = {
  inputRows: EvReportInputRow[];
  derivedRows: EvReportDerivedRow[];
  workplaceRejectedKwh: number;
};

function formatDeNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatEvKwh(value: number): string {
  return `${formatDeNumber(Math.round(value))} kWh`;
}

export function formatEvChargePowerKw(kw: number): string {
  const digits = Number.isInteger(kw) ? 0 : 1;
  return `${formatDeNumber(kw, digits)} kW`;
}

function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatEvHomeWindow(window: EvHomeWindow): string {
  if (window.kind === "fullDay") return "Ganztägig verfügbar";
  if (window.kind === "unavailable") return "Nicht verfügbar";
  return `${formatClock(window.start.hour, window.start.minute)}–${formatClock(
    window.end.hour,
    window.end.minute
  )}`;
}

function yearIndependent<T>(
  ev: EvCalculationMeta,
  read: (meta: EvProfileMeta) => T,
  equal: (a: T, b: T) => boolean,
  name: string
): T {
  const first = ev.byYear[ev.years[0]];
  if (!first) {
    throw new Error(`ev report: missing metadata for year ${ev.years[0]}`);
  }
  const expected = read(first);
  for (const year of ev.years) {
    const meta = ev.byYear[year];
    if (!meta) {
      throw new Error(`ev report: missing metadata for year ${year}`);
    }
    if (!equal(read(meta), expected)) {
      throw new Error(`ev report: ${name} differs across weather years`);
    }
  }
  return expected;
}

function sameJson<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function deriveEvReportView(ev: EvCalculationMeta): EvReportView {
  const annualKm = yearIndependent(
    ev,
    (meta) => meta.annualKm,
    (a, b) => a === b,
    "annualKm"
  );
  const consumption = yearIndependent(
    ev,
    (meta) => meta.consumptionKwhPer100Km,
    (a, b) => a === b,
    "consumptionKwhPer100Km"
  );
  const capacity = yearIndependent(
    ev,
    (meta) => meta.usableBatteryCapacityKwh,
    (a, b) => a === b,
    "usableBatteryCapacityKwh"
  );
  const power = yearIndependent(
    ev,
    (meta) => meta.maxHomeChargePowerKw,
    (a, b) => a === b,
    "maxHomeChargePowerKw"
  );
  const windows = yearIndependent(
    ev,
    (meta) => meta.windows,
    sameJson,
    "windows"
  );
  const workplace = yearIndependent(
    ev,
    (meta) => meta.workplace,
    sameJson,
    "workplace"
  );

  const inputRows: EvReportInputRow[] = [
    {
      label: "Jahresfahrleistung",
      value: `${formatDeNumber(annualKm)} km / Jahr`,
    },
    {
      label: "Stromverbrauch",
      value: `${formatDeNumber(consumption, Number.isInteger(consumption) ? 0 : 1)} kWh / 100 km`,
    },
    {
      label: "nutzbare Batteriekapazität",
      value: `${formatDeNumber(capacity, Number.isInteger(capacity) ? 0 : 1)} kWh`,
    },
    {
      label: "typische Fahrstrecke Montag–Freitag",
      value: `${formatDeNumber(ev.typicalDailyKm.WD)} km / Tag`,
    },
    {
      label: "typische Fahrstrecke Samstag",
      value: `${formatDeNumber(ev.typicalDailyKm.SA)} km`,
    },
    {
      label: "typische Fahrstrecke Sonntag",
      value: `${formatDeNumber(ev.typicalDailyKm.SU)} km`,
    },
    {
      label: "maximale Heimladeleistung",
      value: formatEvChargePowerKw(power),
    },
    {
      label: "Ladefenster Montag–Freitag",
      value: formatEvHomeWindow(windows.WD),
    },
    {
      label: "Ladefenster Samstag",
      value: formatEvHomeWindow(windows.SA),
    },
    {
      label: "Ladefenster Sonntag",
      value: formatEvHomeWindow(windows.SU),
    },
    {
      label: "Laden am Arbeitsplatz",
      value: workplace.enabled ? "Ja" : "Nein",
    },
  ];

  if (workplace.enabled) {
    inputRows.push(
      {
        label: "kWh / Monat",
        value: `${formatDeNumber(workplace.kwhPerMonth, Number.isInteger(workplace.kwhPerMonth) ? 0 : 1)} kWh / Monat`,
      },
      {
        label: "Ladetage / Monat",
        value: `${formatDeNumber(workplace.chargingDaysPerMonth)} Tage / Monat`,
      }
    );
  }

  const derivedRows: EvReportDerivedRow[] = [
    {
      label: "Jährlicher EV-Energiebedarf",
      valueKwh: ev.annualDrivingDemandKwh,
    },
    {
      label: "Davon am Arbeitsplatz geladen",
      valueKwh: ev.averageWorkplaceAcceptedKwh,
    },
    {
      label: "Zu Hause geladen",
      valueKwh: ev.averageHomeChargedKwh,
    },
  ];

  return {
    inputRows,
    derivedRows,
    workplaceRejectedKwh: ev.averageWorkplaceRejectedKwh,
  };
}

export const EV_REPORT_COPY = {
  heading: "Ihre Angaben zum Elektroauto",
  derivedHeading: "Berechneter EV-Energiebedarf",
  basedOnInputs: "Die Berechnung basiert auf den oben angegebenen Eingabedaten.",
  sizeMayChange:
    "Ändern sich diese Eingabedaten, kann sich auch die empfohlene Speichergröße ändern.",
  workplaceRejected:
    "Ein Teil der angegebenen Arbeitsplatzladung konnte nicht aufgenommen werden, weil die Fahrzeugbatterie bereits voll war.",
  householdLoad: "Haushaltsverbrauch",
  heatPumpLoad: "Wärmepumpe",
  evHomeLoad: "EV-Heimladung",
  modelledLoadTotal: "Gesamte modellierte Last",
} as const;
