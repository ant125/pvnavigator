import type { SpeicherInput } from "../types/speicher";
import {
  formatAzimuthLabel,
  formatKwpDisplay,
  formatTiltLabel,
  surfacesOrDefault,
  sumSurfaceKwP,
} from "./calculateFormModel";
import { METRIC_VALUE } from "./formStyles";

const HEAT_PUMP_TECHNOLOGY_LABELS = {
  luftwasser: "Luft/Wasser",
  wasserwasser: "Wasser/Wasser",
} as const;

const HEAT_PUMP_DHW_LABELS = {
  space_heat_and_dhw: "Heizung und Warmwasser",
  space_heat_only: "Nur Heizung",
} as const;

function Row({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-line-soft py-2 first:border-t-0 first:pt-0">
      <dt className="text-sm text-ink-secondary">{label}</dt>
      <dd className={`${METRIC_VALUE} text-sm`}>
        {value}
        {unit ? (
          <span className="ml-1.5 font-sans text-xs text-ink-muted">{unit}</span>
        ) : null}
      </dd>
    </div>
  );
}

export function SelectedSystemSummary({
  formData,
}: {
  formData: Partial<SpeicherInput>;
}) {
  const surfaces = surfacesOrDefault(formData);
  const totalKwP = sumSurfaceKwP(surfaces);
  const first = surfaces[0];
  const heatPump = formData.heatPumpEnabled === true;
  const ev = formData.evEnabled === true;
  const backup = (formData.backupReserveKwh ?? 0) > 0;

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent-text">
        Vorschau der ausgewählten Komponenten
      </p>
      <dl className="mt-3">
        <Row
          label="PV-Anlage"
          value={
            Number.isFinite(totalKwP) && totalKwP > 0
              ? formatKwpDisplay(totalKwP)
              : "—"
          }
          unit="kWp"
        />
        {surfaces.length === 1 ? (
          <Row
            label="Ausrichtung / Neigung"
            value={`${formatAzimuthLabel(first.azimuthDeg)} · ${formatTiltLabel(first.tiltDeg)}`}
          />
        ) : (
          <Row
            label="Dachflächen"
            value={String(surfaces.length)}
          />
        )}
        <Row
          label="Haushalt"
          value={
            typeof formData.annualConsumptionKwh === "number" &&
            Number.isFinite(formData.annualConsumptionKwh)
              ? formData.annualConsumptionKwh.toLocaleString("de-DE")
              : "—"
          }
          unit="kWh/Jahr"
        />
        {heatPump ? (
          <>
            <Row
              label="Wärmepumpe"
              value={
                formData.heatPumpTechnology
                  ? HEAT_PUMP_TECHNOLOGY_LABELS[formData.heatPumpTechnology]
                  : "gewählt"
              }
            />
            {formData.heatPumpDhwService ? (
              <Row
                label="Nutzung"
                value={HEAT_PUMP_DHW_LABELS[formData.heatPumpDhwService]}
              />
            ) : null}
            <Row
              label="WP-Stromverbrauch"
              value={
                typeof formData.heatPumpConsumptionKwh === "number"
                  ? formData.heatPumpConsumptionKwh.toLocaleString("de-DE")
                  : "—"
              }
              unit="kWh/Jahr"
            />
          </>
        ) : null}
        {ev ? (
          <Row
            label="Elektroauto"
            value={
              typeof formData.evAnnualKm === "number"
                ? formData.evAnnualKm.toLocaleString("de-DE")
                : "gewählt"
            }
            unit={typeof formData.evAnnualKm === "number" ? "km/Jahr" : undefined}
          />
        ) : null}
        {backup ? (
          <Row
            label="Notstromreserve"
            value={String(formData.backupReserveKwh)}
            unit="kWh"
          />
        ) : null}
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        Schematische Darstellung der gewählten Komponenten – nicht die Geometrie
        Ihres Gebäudes. Eine Speicherkapazität erscheint erst nach der
        Berechnung.
      </p>
    </div>
  );
}
