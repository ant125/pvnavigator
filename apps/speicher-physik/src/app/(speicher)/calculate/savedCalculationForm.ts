import type { ReportAccessKind } from "@pv-access/core";

import type { FrozenSpeicherPresentation } from "@/lib/persistCompletedCalculation";
import type { ReportHeatPumpCitation } from "@/lib/reportMethodologySources";

import type { PvSurfaceInput, SpeicherInput } from "../types/speicher";
import {
  type HouseholdCalculationPayload,
  type SpeicherGrenzPayload,
  type VerifiedResult,
  type WpuqRobustnessPayload,
  type WwRobustnessPayload,
} from "./actions";
import { formatKwpDisplay, sumSurfaceKwP } from "./calculateFormModel";
import {
  isEvHomeChargePowerKw,
  validateHomeWindowForm,
} from "../utils/evForm";

/**
 * A stored field the saved calculation does not contain.
 * Shown as a gap; never filled with a form default.
 */
export type SavedInputGap = {
  id: string;
  label: string;
};

export type HydratedSavedInputs = {
  formData: Partial<SpeicherInput>;
  kwpInputStrings: string[];
  azimuthInputStrings: string[];
  tiltInputStrings: string[];
  missing: SavedInputGap[];
  surfaces: PvSurfaceInput[];
  annualConsumptionKwh: number | undefined;
  heatPumpEnabled: boolean | undefined;
  heatPumpConsumptionKwh: number | undefined;
  heatPumpTechnology: SpeicherInput["heatPumpTechnology"];
  heatPumpDhwService: SpeicherInput["heatPumpDhwService"];
  evEnabled: boolean | undefined;
  backupReserveKwh: number | undefined;
  totalKwPConfigured: number;
};

/** Saved report plus the form state reconstructed from its stored input. */
export type SavedCalculationView = {
  id: string;
  createdAt: string;
  accessKind: ReportAccessKind;
  batteryModelVersion: string | null;
  displayAddress: string | null;
  verifiedResult: VerifiedResult;
  speicherGrenz: SpeicherGrenzPayload;
  robustness: WpuqRobustnessPayload | null;
  wasserWasserRobustness: WwRobustnessPayload | null;
  ev: HouseholdCalculationPayload["ev"];
  heatPumpCitation: ReportHeatPumpCitation;
  presentationOverride: FrozenSpeicherPresentation | null;
  hydrated: HydratedSavedInputs;
};

const BLANK_SURFACE: PvSurfaceInput = {
  systemSizeKwP: Number.NaN,
  tiltDeg: Number.NaN,
  azimuthDeg: Number.NaN,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asStoredString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function gap(id: string, label: string): SavedInputGap {
  return { id, label };
}

function finiteAngleString(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

function clockString(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const hour = asFiniteNumber(value.hour);
  const minute = asFiniteNumber(value.minute);
  if (
    hour === undefined ||
    minute === undefined ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    (minute !== 0 && minute !== 15 && minute !== 30 && minute !== 45)
  ) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function homeWindowForm(
  value: unknown
): SpeicherInput["evHomeWindowWd"] | undefined {
  if (!isRecord(value) || value.kind !== "bounded") return undefined;
  const start = clockString(value.start);
  const end = clockString(value.end);
  if (!start || !end || start === end) return undefined;
  return { start, end };
}

function heatPumpTechnology(
  value: unknown
): SpeicherInput["heatPumpTechnology"] | undefined {
  if (value === "luftwasser" || value === "wasserwasser") return value;
  return undefined;
}

function heatPumpDhw(
  value: unknown
): SpeicherInput["heatPumpDhwService"] | undefined {
  if (value === "space_heat_only" || value === "space_heat_and_dhw") {
    return value;
  }
  return undefined;
}

function surfaceFromRecord(
  value: unknown,
  index: number,
  missing: SavedInputGap[]
): PvSurfaceInput {
  const roof = `Dachfläche ${index + 1}`;
  const record = isRecord(value) ? value : null;
  const systemSizeKwP = record
    ? asFiniteNumber(record.systemSizeKwP)
    : undefined;
  const tiltDeg = record ? asFiniteNumber(record.tiltDeg) : undefined;
  const azimuthDeg = record ? asFiniteNumber(record.azimuthDeg) : undefined;
  if (systemSizeKwP === undefined) {
    missing.push(gap(`surface:${index}:kwp`, `${roof}: PV-Leistung`));
  }
  if (azimuthDeg === undefined) {
    missing.push(gap(`surface:${index}:azimuth`, `${roof}: Ausrichtung`));
  }
  if (tiltDeg === undefined) {
    missing.push(gap(`surface:${index}:tilt`, `${roof}: Neigung`));
  }
  return {
    systemSizeKwP: systemSizeKwP ?? Number.NaN,
    tiltDeg: tiltDeg ?? Number.NaN,
    azimuthDeg: azimuthDeg ?? Number.NaN,
  };
}

function surfacesFromInput(
  input: Record<string, unknown>,
  missing: SavedInputGap[]
): PvSurfaceInput[] {
  if (Array.isArray(input.pvSurfaces) && input.pvSurfaces.length > 0) {
    return input.pvSurfaces.map((row, index) =>
      surfaceFromRecord(row, index, missing)
    );
  }

  const hasLegacy =
    "tiltDeg" in input || "azimuthDeg" in input || "pvSystemKwP" in input;
  if (!hasLegacy && !("pvSurfaces" in input)) {
    missing.push(gap("surface:0:kwp", "Dachfläche 1: PV-Leistung"));
    missing.push(gap("surface:0:azimuth", "Dachfläche 1: Ausrichtung"));
    missing.push(gap("surface:0:tilt", "Dachfläche 1: Neigung"));
    return [{ ...BLANK_SURFACE }];
  }

  return [
    surfaceFromRecord(
      {
        systemSizeKwP: input.pvSystemKwP,
        tiltDeg: input.tiltDeg,
        azimuthDeg: input.azimuthDeg,
      },
      0,
      missing
    ),
  ];
}

function requireFinite(
  missing: SavedInputGap[],
  id: string,
  label: string,
  value: number | undefined
): number | undefined {
  if (value === undefined) {
    missing.push(gap(id, label));
    return undefined;
  }
  return value;
}

function hydrateEv(
  input: Record<string, unknown>,
  formData: Partial<SpeicherInput>,
  missing: SavedInputGap[]
) {
  if (!("ev" in input)) {
    missing.push(gap("evEnabled", "Elektroauto"));
    return;
  }
  if (!isRecord(input.ev)) {
    missing.push(gap("evEnabled", "Elektroauto"));
    return;
  }
  const enabled = asBoolean(input.ev.enabled);
  if (enabled === undefined) {
    missing.push(gap("evEnabled", "Elektroauto"));
    return;
  }
  formData.evEnabled = enabled;
  if (!enabled) return;

  formData.evAnnualKm = requireFinite(
    missing,
    "evAnnualKm",
    "Elektroauto: Jahresfahrleistung",
    asFiniteNumber(input.ev.annualKm)
  );
  formData.evConsumptionKwhPer100Km = requireFinite(
    missing,
    "evConsumptionKwhPer100Km",
    "Elektroauto: Verbrauch",
    asFiniteNumber(input.ev.consumptionKwhPer100Km)
  );
  formData.evUsableBatteryCapacityKwh = requireFinite(
    missing,
    "evUsableBatteryCapacityKwh",
    "Elektroauto: Nutzbare Batterie",
    asFiniteNumber(input.ev.usableBatteryCapacityKwh)
  );

  const typical = isRecord(input.ev.typicalDailyKm)
    ? input.ev.typicalDailyKm
    : null;
  formData.evTypicalDailyKmWd = requireFinite(
    missing,
    "evTypicalDailyKmWd",
    "Elektroauto: Fahrstrecke Mo–Fr",
    typical ? asFiniteNumber(typical.WD) : undefined
  );
  formData.evTypicalDailyKmSa = requireFinite(
    missing,
    "evTypicalDailyKmSa",
    "Elektroauto: Fahrstrecke Sa",
    typical ? asFiniteNumber(typical.SA) : undefined
  );
  formData.evTypicalDailyKmSu = requireFinite(
    missing,
    "evTypicalDailyKmSu",
    "Elektroauto: Fahrstrecke So",
    typical ? asFiniteNumber(typical.SU) : undefined
  );

  const power = asFiniteNumber(input.ev.maxHomeChargePowerKw);
  if (power !== undefined && isEvHomeChargePowerKw(power)) {
    formData.evMaxHomeChargePowerKw = power;
  } else {
    missing.push(gap("evMaxHomeChargePowerKw", "Elektroauto: Ladeleistung"));
  }

  const windows = isRecord(input.ev.homeWindow) ? input.ev.homeWindow : null;
  const wd = windows ? homeWindowForm(windows.WD) : undefined;
  const sa = windows ? homeWindowForm(windows.SA) : undefined;
  const su = windows ? homeWindowForm(windows.SU) : undefined;
  if (wd && validateHomeWindowForm(wd) === "ok") formData.evHomeWindowWd = wd;
  else missing.push(gap("evHomeWindowWd", "Elektroauto: Ladefenster Mo–Fr"));
  if (sa && validateHomeWindowForm(sa) === "ok") formData.evHomeWindowSa = sa;
  else missing.push(gap("evHomeWindowSa", "Elektroauto: Ladefenster Sa"));
  if (su && validateHomeWindowForm(su) === "ok") formData.evHomeWindowSu = su;
  else missing.push(gap("evHomeWindowSu", "Elektroauto: Ladefenster So"));

  if (!isRecord(input.ev.workplace)) {
    missing.push(
      gap("evWorkplaceEnabled", "Elektroauto: Laden am Arbeitsplatz")
    );
    return;
  }
  const workplaceEnabled = asBoolean(input.ev.workplace.enabled);
  if (workplaceEnabled === undefined) {
    missing.push(
      gap("evWorkplaceEnabled", "Elektroauto: Laden am Arbeitsplatz")
    );
    return;
  }
  formData.evWorkplaceEnabled = workplaceEnabled;
  if (!workplaceEnabled) return;
  formData.evWorkplaceKwhPerMonth = requireFinite(
    missing,
    "evWorkplaceKwhPerMonth",
    "Elektroauto: Monatliche Ladung",
    asFiniteNumber(input.ev.workplace.kwhPerMonth)
  );
  const days = asFiniteNumber(input.ev.workplace.chargingDaysPerMonth);
  if (days !== undefined && Number.isInteger(days)) {
    formData.evWorkplaceChargingDaysPerMonth = days;
  } else {
    missing.push(gap("evWorkplaceChargingDaysPerMonth", "Elektroauto: Ladetage"));
  }
}

function totalKwP(
  input: Record<string, unknown>,
  surfaces: PvSurfaceInput[]
): number {
  const stored = asFiniteNumber(input.pvSystemKwP);
  if (stored !== undefined) return stored;
  if (
    surfaces.length > 0 &&
    surfaces.every((surface) => Number.isFinite(surface.systemSizeKwP))
  ) {
    return sumSurfaceKwP(surfaces);
  }
  return Number.NaN;
}

/**
 * Rebuilds the calculate form from a stored calculation input.
 * Absent fields stay absent and are listed in `missing`.
 */
export function hydrateSavedCalculationInput(
  input: unknown
): HydratedSavedInputs {
  const missing: SavedInputGap[] = [];
  const source = isRecord(input) ? input : {};
  if (!isRecord(input)) {
    missing.push(gap("input", "Gespeicherte Eingaben"));
  }

  const formData: Partial<SpeicherInput> = {};
  const street = asStoredString(source.street);
  const houseNumber = asStoredString(source.houseNumber);
  const postalCode = asStoredString(source.postalCode);
  const city = asStoredString(source.city);
  if (street === undefined) missing.push(gap("street", "Straße"));
  else formData.street = street;
  if (houseNumber === undefined) missing.push(gap("houseNumber", "Hausnummer"));
  else formData.houseNumber = houseNumber;
  if (postalCode === undefined) missing.push(gap("postalCode", "PLZ"));
  else formData.postalCode = postalCode;
  if (city === undefined) missing.push(gap("city", "Ort"));
  else formData.city = city;

  if ("annualConsumptionKWh" in source || "annualConsumptionKwh" in source) {
    formData.annualConsumptionKwh = requireFinite(
      missing,
      "annualConsumptionKwh",
      "Jahresverbrauch",
      asFiniteNumber(source.annualConsumptionKWh ?? source.annualConsumptionKwh)
    );
  } else {
    missing.push(gap("annualConsumptionKwh", "Jahresverbrauch"));
  }

  const surfaces = surfacesFromInput(source, missing);
  formData.pvSurfaces = surfaces.map((surface) => ({ ...surface }));

  if (!("heatPumpEnabled" in source)) {
    missing.push(gap("heatPumpEnabled", "Wärmepumpe"));
  } else {
    const enabled = asBoolean(source.heatPumpEnabled);
    if (enabled === undefined) {
      missing.push(gap("heatPumpEnabled", "Wärmepumpe"));
    } else {
      formData.heatPumpEnabled = enabled;
      if (enabled) {
        const technology = heatPumpTechnology(source.heatPumpTechnology);
        const dhw = heatPumpDhw(source.heatPumpDhwService);
        if (technology === undefined) {
          missing.push(gap("heatPumpTechnology", "Wärmepumpe: Typ"));
        } else formData.heatPumpTechnology = technology;
        if (dhw === undefined) {
          missing.push(gap("heatPumpDhwService", "Wärmepumpe: Nutzung"));
        } else formData.heatPumpDhwService = dhw;
        formData.heatPumpConsumptionKwh = requireFinite(
          missing,
          "heatPumpConsumptionKwh",
          "Wärmepumpe: Stromverbrauch",
          asFiniteNumber(source.heatPumpConsumptionKWh)
        );
      }
    }
  }

  hydrateEv(source, formData, missing);

  if (!("backupReserveKwh" in source)) {
    missing.push(gap("backupReserveKwh", "Notstromreserve"));
  } else {
    const reserve = asFiniteNumber(source.backupReserveKwh);
    if (reserve === undefined) {
      missing.push(gap("backupReserveKwh", "Notstromreserve"));
    } else {
      formData.backupReserveKwh = reserve;
    }
  }

  return {
    formData,
    kwpInputStrings: surfaces.map((surface) =>
      formatKwpDisplay(surface.systemSizeKwP)
    ),
    azimuthInputStrings: surfaces.map((surface) =>
      finiteAngleString(surface.azimuthDeg)
    ),
    tiltInputStrings: surfaces.map((surface) =>
      finiteAngleString(surface.tiltDeg)
    ),
    missing,
    surfaces,
    annualConsumptionKwh: formData.annualConsumptionKwh,
    heatPumpEnabled: formData.heatPumpEnabled,
    heatPumpConsumptionKwh: formData.heatPumpConsumptionKwh,
    heatPumpTechnology: formData.heatPumpTechnology,
    heatPumpDhwService: formData.heatPumpDhwService,
    evEnabled: formData.evEnabled,
    backupReserveKwh: formData.backupReserveKwh,
    totalKwPConfigured: totalKwP(source, surfaces),
  };
}

function surfaceFieldOpen(
  form: Partial<SpeicherInput>,
  index: number,
  field: string
): boolean {
  const row = form.pvSurfaces?.[index];
  if (!row) return true;
  if (field === "kwp") return !Number.isFinite(row.systemSizeKwP);
  if (field === "azimuth") return !Number.isFinite(row.azimuthDeg);
  if (field === "tilt") return !Number.isFinite(row.tiltDeg);
  return true;
}

/** True while the saved record still has no real value for this gap. */
export function savedInputGapIsOpen(
  form: Partial<SpeicherInput>,
  gapId: string
): boolean {
  const surface = /^surface:(\d+):(kwp|azimuth|tilt)$/.exec(gapId);
  if (surface) {
    return surfaceFieldOpen(form, Number(surface[1]), surface[2]);
  }

  switch (gapId) {
    case "street":
      return !(form.street ?? "").trim();
    case "houseNumber":
      return !(form.houseNumber ?? "").trim();
    case "postalCode":
      return !(form.postalCode ?? "").trim();
    case "city":
      return !(form.city ?? "").trim();
    case "annualConsumptionKwh":
      return !(
        typeof form.annualConsumptionKwh === "number" &&
        Number.isFinite(form.annualConsumptionKwh)
      );
    case "heatPumpEnabled":
      return form.heatPumpEnabled == null;
    case "heatPumpTechnology":
      return form.heatPumpTechnology == null;
    case "heatPumpDhwService":
      return form.heatPumpDhwService == null;
    case "heatPumpConsumptionKwh":
      return !(
        typeof form.heatPumpConsumptionKwh === "number" &&
        Number.isFinite(form.heatPumpConsumptionKwh)
      );
    case "evEnabled":
      return form.evEnabled == null;
    case "evAnnualKm":
      return !(
        typeof form.evAnnualKm === "number" && Number.isFinite(form.evAnnualKm)
      );
    case "evConsumptionKwhPer100Km":
      return !(
        typeof form.evConsumptionKwhPer100Km === "number" &&
        Number.isFinite(form.evConsumptionKwhPer100Km)
      );
    case "evUsableBatteryCapacityKwh":
      return !(
        typeof form.evUsableBatteryCapacityKwh === "number" &&
        Number.isFinite(form.evUsableBatteryCapacityKwh)
      );
    case "evTypicalDailyKmWd":
      return !(
        typeof form.evTypicalDailyKmWd === "number" &&
        Number.isFinite(form.evTypicalDailyKmWd)
      );
    case "evTypicalDailyKmSa":
      return !(
        typeof form.evTypicalDailyKmSa === "number" &&
        Number.isFinite(form.evTypicalDailyKmSa)
      );
    case "evTypicalDailyKmSu":
      return !(
        typeof form.evTypicalDailyKmSu === "number" &&
        Number.isFinite(form.evTypicalDailyKmSu)
      );
    case "evMaxHomeChargePowerKw":
      return !isEvHomeChargePowerKw(form.evMaxHomeChargePowerKw);
    case "evHomeWindowWd":
      return validateHomeWindowForm(form.evHomeWindowWd) !== "ok";
    case "evHomeWindowSa":
      return validateHomeWindowForm(form.evHomeWindowSa) !== "ok";
    case "evHomeWindowSu":
      return validateHomeWindowForm(form.evHomeWindowSu) !== "ok";
    case "evWorkplaceEnabled":
      return form.evWorkplaceEnabled == null;
    case "evWorkplaceKwhPerMonth":
      return !(
        typeof form.evWorkplaceKwhPerMonth === "number" &&
        Number.isFinite(form.evWorkplaceKwhPerMonth)
      );
    case "evWorkplaceChargingDaysPerMonth":
      return !(
        typeof form.evWorkplaceChargingDaysPerMonth === "number" &&
        Number.isFinite(form.evWorkplaceChargingDaysPerMonth)
      );
    case "backupReserveKwh":
      return !(
        typeof form.backupReserveKwh === "number" &&
        Number.isFinite(form.backupReserveKwh)
      );
    default:
      return true;
  }
}
