/**
 * "Anlage & Eingaben" rows and scene components for the PDF.
 * Mirrors the Stammdaten block of SpeicherReportView and the scene rules of
 * SystemScene: only components that are part of the calculation are shown,
 * and a missing boolean is never displayed as "Nein".
 */
import { formatAzimuthLabel, formatTiltLabel } from "@/app/(speicher)/calculate/calculateFormModel";
import { formatQuantityWithUnit } from "@/lib/formatQuantityDe";

const PLACEHOLDER = "—";

const HEAT_PUMP_TECHNOLOGY_LABELS = {
  luftwasser: "Luft/Wasser",
  wasserwasser: "Wasser/Wasser",
} as const;

const HEAT_PUMP_DHW_LABELS = {
  space_heat_and_dhw: "Heizung und Warmwasser",
  space_heat_only: "Nur Heizung",
} as const;

export type InputFacts = {
  displayAddress: string;
  totalKwP: number | undefined;
  surfaces: { systemSizeKwP: number; tiltDeg: number; azimuthDeg: number }[];
  backupReserveKwh: number | undefined;
  annualConsumptionKWh: number | undefined;
  heatPumpEnabled?: boolean;
  heatPumpConsumptionKWh?: number;
  heatPumpTechnology?: "luftwasser" | "wasserwasser";
  heatPumpDhwService?: "space_heat_only" | "space_heat_and_dhw";
  evEnabled?: boolean;
  evAnnualKm?: number;
};

function kwhPerYear(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatQuantityWithUnit(value, "kWh/Jahr")
    : PLACEHOLDER;
}

function quantityOrPlaceholder(value: number | undefined, unit: string): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatQuantityWithUnit(value, unit)
    : PLACEHOLDER;
}

export type InputRow = { label: string; value: string; help?: string };

export type SceneConfig = {
  heatPump: "luftwasser" | "wasserwasser" | null;
  ev: boolean;
  backup: boolean;
};

export function formatKwpDisplay(n: number): string {
  if (!Number.isFinite(n)) return "";
  return parseFloat((Math.round(n * 100) / 100).toFixed(2)).toString();
}

export function buildInputRows(facts: InputFacts): InputRow[] {
  const rows: InputRow[] = [{ label: "Adresse", value: facts.displayAddress }];
  const surfaces = facts.surfaces;

  if (surfaces.length > 1) {
    // Same content as the report view ("Dachfläche i: kWp, Neigung, Ausrichtung"),
    // but one row per roof so the list can paginate row by row.
    rows.push({
      label: "PV-Anlage",
      value:
        typeof facts.totalKwP === "number" && Number.isFinite(facts.totalKwP)
          ? `${formatKwpDisplay(facts.totalKwP)} kWp`
          : PLACEHOLDER,
      help: `auf ${surfaces.length} Dachflächen`,
    });
    surfaces.forEach((s, i) => {
      rows.push({
        label: `Dachfläche ${i + 1}`,
        value: `${
          Number.isFinite(s.systemSizeKwP) ? formatKwpDisplay(s.systemSizeKwP) : PLACEHOLDER
        } kWp, ${s.tiltDeg}°, ${s.azimuthDeg}°`,
      });
    });
  } else {
    rows.push({
      label: "PV-Anlage",
      value:
        typeof facts.totalKwP === "number" && Number.isFinite(facts.totalKwP)
          ? `${formatKwpDisplay(facts.totalKwP)} kWp`
          : PLACEHOLDER,
    });
    if (surfaces.length === 1) {
      rows.push(
        { label: "Neigung", value: `${surfaces[0].tiltDeg}°` },
        { label: "Ausrichtung", value: `${surfaces[0].azimuthDeg}°` },
      );
    }
  }

  if (typeof facts.backupReserveKwh === "number" && facts.backupReserveKwh > 0) {
    rows.push({
      label: "Notstromreserve",
      value: formatQuantityWithUnit(facts.backupReserveKwh, "kWh"),
    });
  }

  rows.push({
    label: "Hausverbrauch (ohne Wärmepumpe)",
    value: kwhPerYear(facts.annualConsumptionKWh),
  });

  // Only known booleans become "Ja"/"Nein"; a missing field is not shown as Nein.
  if (typeof facts.heatPumpEnabled === "boolean") {
    rows.push({ label: "Wärmepumpe", value: facts.heatPumpEnabled ? "Ja" : "Nein" });
  }
  if (facts.heatPumpEnabled === true) {
    if (facts.heatPumpTechnology) {
      rows.push({ label: "Typ", value: HEAT_PUMP_TECHNOLOGY_LABELS[facts.heatPumpTechnology] });
    }
    if (facts.heatPumpDhwService) {
      rows.push({ label: "Verwendung", value: HEAT_PUMP_DHW_LABELS[facts.heatPumpDhwService] });
    }
    rows.push({
      label: "WP-Stromverbrauch",
      value: kwhPerYear(facts.heatPumpConsumptionKWh),
    });
  }

  if (typeof facts.evEnabled === "boolean") {
    rows.push({ label: "Elektroauto", value: facts.evEnabled ? "Ja" : "Nein" });
  }
  if (facts.evEnabled === true && typeof facts.evAnnualKm === "number") {
    rows.push({
      label: "Jahresfahrleistung",
      value: formatQuantityWithUnit(facts.evAnnualKm, "km/Jahr"),
    });
  }

  const household = facts.annualConsumptionKWh;
  const heatPumpKwh = facts.heatPumpConsumptionKWh;
  const householdKnown =
    typeof household === "number" && Number.isFinite(household);
  const heatPumpKnown =
    typeof heatPumpKwh === "number" && Number.isFinite(heatPumpKwh);
  const total =
    householdKnown && (facts.heatPumpEnabled !== true || heatPumpKnown)
      ? household + (facts.heatPumpEnabled === true && heatPumpKnown ? heatPumpKwh : 0)
      : undefined;
  rows.push({
    label: "Gesamtverbrauch",
    value: kwhPerYear(total),
    help:
      facts.heatPumpEnabled === true
        ? `davon Wärmepumpe: ${quantityOrPlaceholder(facts.heatPumpConsumptionKWh, "kWh")}`
        : undefined,
  });

  return rows;
}

export type FactChip = { text: string };

/**
 * Compact cover facts. One roof keeps orientation and tilt as their own chips.
 * Several roofs never share one orientation: each plane names its own power,
 * azimuth and tilt. Extra components appear only when they are part of the
 * calculation.
 */
export function buildFactChips(facts: InputFacts): FactChip[] {
  const chips: FactChip[] = [];
  const surfaces = facts.surfaces;
  const kwp = (n: number) =>
    Number.isFinite(n) ? `${formatKwpDisplay(n)} kWp` : PLACEHOLDER;

  chips.push({
    text: `PV-Anlage · ${
      typeof facts.totalKwP === "number" && Number.isFinite(facts.totalKwP)
        ? kwp(facts.totalKwP)
        : PLACEHOLDER
    }`,
  });
  chips.push({
    text: `Hausverbrauch ohne Wärmepumpe · ${kwhPerYear(facts.annualConsumptionKWh)}`,
  });

  if (surfaces.length <= 1 && surfaces[0]) {
    chips.push({ text: `Ausrichtung · ${formatAzimuthLabel(surfaces[0].azimuthDeg)}` });
    chips.push({ text: `Neigung · ${formatTiltLabel(surfaces[0].tiltDeg)}` });
  } else {
    surfaces.forEach((surface, index) => {
      chips.push({
        text: `Dachfläche ${index + 1} · ${kwp(surface.systemSizeKwP)} · ${formatAzimuthLabel(surface.azimuthDeg)} · ${formatTiltLabel(surface.tiltDeg)}`,
      });
    });
  }

  if (typeof facts.backupReserveKwh === "number" && facts.backupReserveKwh > 0) {
    chips.push({
      text: `Notstromreserve · ${formatQuantityWithUnit(facts.backupReserveKwh, "kWh")}`,
    });
  }

  if (facts.heatPumpEnabled === true) {
    chips.push({
      text: facts.heatPumpTechnology
        ? `Wärmepumpe · ${HEAT_PUMP_TECHNOLOGY_LABELS[facts.heatPumpTechnology]}`
        : "Wärmepumpe · Ja",
    });
    if (facts.heatPumpDhwService) {
      chips.push({
        text: `Verwendung · ${HEAT_PUMP_DHW_LABELS[facts.heatPumpDhwService]}`,
      });
    }
    chips.push({
      text: `WP-Stromverbrauch · ${kwhPerYear(facts.heatPumpConsumptionKWh)}`,
    });
  }

  if (facts.evEnabled === true) {
    chips.push({
      text:
        typeof facts.evAnnualKm === "number"
          ? `Elektroauto · ${formatQuantityWithUnit(facts.evAnnualKm, "km/Jahr")}`
          : "Elektroauto · Ja",
    });
  }

  return chips;
}

export function buildSceneConfig(facts: InputFacts): SceneConfig {
  // Same visibility rule as SystemScene: a heat pump without a known
  // technology has no drawing and is therefore not added to the scene.
  const heatPump =
    facts.heatPumpEnabled === true &&
    (facts.heatPumpTechnology === "luftwasser" || facts.heatPumpTechnology === "wasserwasser")
      ? facts.heatPumpTechnology
      : null;
  return {
    heatPump,
    ev: facts.evEnabled === true,
    backup:
      typeof facts.backupReserveKwh === "number" && facts.backupReserveKwh > 0,
  };
}
