import type { SpeicherInput } from "../types/speicher";
import {
  formatKwpDisplay,
  surfacesOrDefault,
  sumSurfaceKwP,
} from "./calculateFormModel";

const HEAT_PUMP_TECHNOLOGY_LABELS = {
  luftwasser: "Luft/Wasser",
  wasserwasser: "Wasser/Wasser",
} as const;

export type SelectedSystemChip = {
  key: "pv" | "heatPump" | "ev" | "backup";
  label: string;
};

export function buildSelectedSystemChips(
  formData: Partial<SpeicherInput>
): SelectedSystemChip[] {
  const chips: SelectedSystemChip[] = [];
  const surfaces = surfacesOrDefault(formData);
  const totalKwP = sumSurfaceKwP(surfaces);

  if (Number.isFinite(totalKwP) && totalKwP > 0) {
    const pvLabel =
      surfaces.length > 1
        ? `PV · ${formatKwpDisplay(totalKwP)} kWp · ${surfaces.length} Flächen`
        : `PV · ${formatKwpDisplay(totalKwP)} kWp`;
    chips.push({ key: "pv", label: pvLabel });
  }

  if (formData.heatPumpEnabled === true) {
    const technology = formData.heatPumpTechnology;
    chips.push({
      key: "heatPump",
      label:
        technology === "luftwasser" || technology === "wasserwasser"
          ? `Wärmepumpe · ${HEAT_PUMP_TECHNOLOGY_LABELS[technology]}`
          : "Wärmepumpe",
    });
  }

  if (formData.evEnabled === true) {
    chips.push({ key: "ev", label: "Elektroauto" });
  }

  if ((formData.backupReserveKwh ?? 0) > 0) {
    chips.push({
      key: "backup",
      label: `Notstrom · ${formData.backupReserveKwh} kWh`,
    });
  }

  return chips;
}

export function SelectedSystemChips({
  formData,
}: {
  formData: Partial<SpeicherInput>;
}) {
  const chips = buildSelectedSystemChips(formData);

  return (
    <div className="mt-3">
      {chips.length > 0 ? (
        <ul
          aria-label="Ausgewählte Komponenten"
          className="flex flex-wrap gap-2"
        >
          {chips.map((chip) => (
            <li
              key={chip.key}
              className="rounded-sm border border-line bg-surface-muted px-2.5 py-1 font-mono text-[11px] leading-snug text-ink"
            >
              {chip.label}
            </li>
          ))}
        </ul>
      ) : null}
      <p
        className={`text-[11px] leading-relaxed text-ink-muted ${
          chips.length > 0 ? "mt-3" : ""
        }`}
      >
        Schematische Darstellung der gewählten Komponenten – nicht die Geometrie
        Ihres Gebäudes. Eine Speicherkapazität erscheint erst nach der
        Berechnung.
      </p>
    </div>
  );
}
