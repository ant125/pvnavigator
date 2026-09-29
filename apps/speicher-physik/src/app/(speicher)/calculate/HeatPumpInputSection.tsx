"use client";

import type { SpeicherInput } from "../types/speicher";
import type {
  SpeicherFieldErrorKey,
  SpeicherFieldErrors,
} from "../utils/validateInput";
import type { PresetDropdownOption } from "./calculateFormModel";
import { PresetDropdown } from "./PresetDropdown";
import {
  FORM_HELP,
  FORM_LABEL,
  FORM_RADIO_LABEL,
  quantityInputProps,
  UNIT_FIELD_INPUT_CLASS,
  UNIT_FIELD_SUFFIX_CLASS,
  suppressPointerFocus,
  unitFieldControlClassName,
} from "./formStyles";

export const HEAT_PUMP_FORM_COPY = {
  enableQuestion: "Wärmepumpe vorhanden?",
  no: "Nein",
  yes: "Ja",
  typeLabel: "Typ",
  usageLabel: "Nutzung",
  consumptionLabel: "Stromverbrauch",
  consumptionUnit: "kWh/Jahr",
  consumptionHelp: "Separater Jahresstromverbrauch der Wärmepumpe.",
  consumptionPlaceholder: "z. B. 5000",
  typePlaceholder: "Auswählen",
  usagePlaceholder: "Auswählen",
  thermBuildNote: "Gemessenes ThermBuild-Referenzprofil",
  typeHelp: {
    luftwasser: "Außenluft als Wärmequelle.",
    wasserwasser: "Grundwasser oder kaltes Nahwärmenetz als Wärmequelle.",
  },
} as const;

export const DISABLED_HEAT_PUMP_FORM_FIELDS: Partial<SpeicherInput> = {
  heatPumpEnabled: false,
  heatPumpConsumptionKwh: undefined,
  heatPumpTechnology: undefined,
  heatPumpDhwService: undefined,
};

export const HEAT_PUMP_TECHNOLOGY_OPTIONS = [
  { value: "luftwasser", label: "Luft/Wasser" },
  { value: "wasserwasser", label: "Wasser/Wasser" },
] as const satisfies ReadonlyArray<
  PresetDropdownOption<NonNullable<SpeicherInput["heatPumpTechnology"]>>
>;

const HEAT_PUMP_DHW_BOTH: PresetDropdownOption<
  NonNullable<SpeicherInput["heatPumpDhwService"]>
> = {
  value: "space_heat_and_dhw",
  label: "Heizung und Warmwasser",
};

const HEAT_PUMP_DHW_HEAT_ONLY: PresetDropdownOption<
  NonNullable<SpeicherInput["heatPumpDhwService"]>
> = {
  value: "space_heat_only",
  label: "Nur Heizung",
};

export function patchForHeatPumpEnabled(
  enabled: boolean
): Partial<SpeicherInput> {
  return enabled
    ? { heatPumpEnabled: true }
    : { ...DISABLED_HEAT_PUMP_FORM_FIELDS };
}

export function patchHeatPumpTechnology(
  prev: Pick<Partial<SpeicherInput>, "heatPumpDhwService">,
  technology: NonNullable<SpeicherInput["heatPumpTechnology"]>
): Partial<SpeicherInput> {
  if (technology === "wasserwasser") {
    return {
      heatPumpTechnology: "wasserwasser",
      heatPumpDhwService:
        prev.heatPumpDhwService === "space_heat_only"
          ? undefined
          : prev.heatPumpDhwService,
    };
  }
  return { heatPumpTechnology: "luftwasser" };
}

export function heatPumpDhwOptions(
  technology: NonNullable<SpeicherInput["heatPumpTechnology"]>
): ReadonlyArray<
  PresetDropdownOption<NonNullable<SpeicherInput["heatPumpDhwService"]>>
> {
  if (technology === "luftwasser") {
    return [HEAT_PUMP_DHW_HEAT_ONLY, HEAT_PUMP_DHW_BOTH];
  }
  return [HEAT_PUMP_DHW_BOTH];
}

/** Existing Wärmepumpe consumption parser: `parseInt(raw, 10) || undefined`. */
export function parseHeatPumpConsumptionInput(
  raw: string
): number | undefined {
  return parseInt(raw, 10) || undefined;
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-danger">
      {message}
    </p>
  );
}

export function HeatPumpEnableToggle({
  heatPumpEnabled,
  onChange,
}: {
  heatPumpEnabled: boolean;
  onChange: (patch: Partial<SpeicherInput>) => void;
}) {
  return (
    <fieldset className="ml-auto shrink-0 self-center">
      <legend className="sr-only">{HEAT_PUMP_FORM_COPY.enableQuestion}</legend>
      <div className="flex items-center gap-3">
        <label className={FORM_RADIO_LABEL} onMouseDown={suppressPointerFocus}>
          <input
            type="radio"
            name="heatPumpEnabled"
            checked={!heatPumpEnabled}
            onChange={() => onChange(patchForHeatPumpEnabled(false))}
            className="h-4 w-4 shrink-0 border-field-border accent-accent"
          />
          {HEAT_PUMP_FORM_COPY.no}
        </label>
        <label className={FORM_RADIO_LABEL} onMouseDown={suppressPointerFocus}>
          <input
            type="radio"
            name="heatPumpEnabled"
            checked={heatPumpEnabled}
            onChange={() => onChange(patchForHeatPumpEnabled(true))}
            className="h-4 w-4 shrink-0 border-field-border accent-accent"
          />
          {HEAT_PUMP_FORM_COPY.yes}
        </label>
      </div>
    </fieldset>
  );
}

type HeatPumpInputSectionProps = {
  formData: Partial<SpeicherInput>;
  fieldErrors: SpeicherFieldErrors;
  onChange: (patch: Partial<SpeicherInput>) => void;
  clearFieldError: (field: SpeicherFieldErrorKey) => void;
};

export function HeatPumpInputSection({
  formData,
  fieldErrors,
  onChange,
  clearFieldError,
}: HeatPumpInputSectionProps) {
  const technology = formData.heatPumpTechnology;
  const typeSelected =
    technology === "luftwasser" || technology === "wasserwasser";
  const typeHelpId = typeSelected ? "heatPumpTechnology-help" : undefined;
  const consumptionHelpId = "heatPumpConsumptionKwh-help";
  const consumptionUnitId = "heatPumpConsumptionKwh-unit";
  const dhwOptions = typeSelected ? heatPumpDhwOptions(technology) : [];

  return (
    <div className="min-w-0 space-y-field-group-gap">
      <div className="min-w-0 space-y-1">
        <label className={FORM_LABEL} htmlFor="heatPumpTechnology">
          {HEAT_PUMP_FORM_COPY.typeLabel}
        </label>
        <PresetDropdown
          id="heatPumpTechnology"
          value={typeSelected ? technology : ""}
          placeholder={HEAT_PUMP_FORM_COPY.typePlaceholder}
          hasError={!!fieldErrors.heatPumpTechnology}
          describedBy={
            [
              fieldErrors.heatPumpTechnology
                ? "heatPumpTechnology-error"
                : null,
              typeHelpId,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          options={[...HEAT_PUMP_TECHNOLOGY_OPTIONS]}
          onChange={(next) => {
            clearFieldError("heatPumpTechnology");
            if (next === "wasserwasser") {
              clearFieldError("heatPumpDhwService");
            }
            onChange(patchHeatPumpTechnology(formData, next));
          }}
        />
        <FieldError
          id="heatPumpTechnology-error"
          message={fieldErrors.heatPumpTechnology}
        />
        {typeSelected ? (
          <p id={typeHelpId} className={FORM_HELP}>
            {HEAT_PUMP_FORM_COPY.typeHelp[technology]}
          </p>
        ) : null}
      </div>

      {technology === "luftwasser" ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-muted">
          <span className="mt-px" aria-hidden>
            ✓
          </span>
          {HEAT_PUMP_FORM_COPY.thermBuildNote}
        </p>
      ) : null}

      {typeSelected ? (
        <div className="min-w-0 space-y-1">
          <label className={FORM_LABEL} htmlFor="heatPumpDhwService">
            {HEAT_PUMP_FORM_COPY.usageLabel}
          </label>
          <PresetDropdown
            id="heatPumpDhwService"
            value={formData.heatPumpDhwService ?? ""}
            placeholder={HEAT_PUMP_FORM_COPY.usagePlaceholder}
            hasError={!!fieldErrors.heatPumpDhwService}
            describedBy={
              fieldErrors.heatPumpDhwService
                ? "heatPumpDhwService-error"
                : undefined
            }
            options={[...dhwOptions]}
            onChange={(next) => {
              clearFieldError("heatPumpDhwService");
              onChange({ heatPumpDhwService: next });
            }}
          />
          <FieldError
            id="heatPumpDhwService-error"
            message={fieldErrors.heatPumpDhwService}
          />
        </div>
      ) : null}

      <div className="min-w-0 space-y-1">
        <label className={FORM_LABEL} htmlFor="heatPumpConsumptionKwh">
          {HEAT_PUMP_FORM_COPY.consumptionLabel}
        </label>
        <div
          className={unitFieldControlClassName(
            !!fieldErrors.heatPumpConsumptionKwh
          )}
        >
          <input
            id="heatPumpConsumptionKwh"
            {...quantityInputProps("numeric")}
            name="heatPumpConsumptionKwh"
            min="1"
            value={formData.heatPumpConsumptionKwh ?? ""}
            onChange={(e) => {
              clearFieldError("heatPumpConsumptionKwh");
              onChange({
                heatPumpConsumptionKwh: parseHeatPumpConsumptionInput(
                  e.target.value
                ),
              });
            }}
            aria-invalid={
              fieldErrors.heatPumpConsumptionKwh ? true : undefined
            }
            aria-describedby={
              fieldErrors.heatPumpConsumptionKwh
                ? `${consumptionUnitId} heatPumpConsumptionKwh-error ${consumptionHelpId}`
                : `${consumptionUnitId} ${consumptionHelpId}`
            }
            className={UNIT_FIELD_INPUT_CLASS}
            placeholder={HEAT_PUMP_FORM_COPY.consumptionPlaceholder}
          />
          <span id={consumptionUnitId} className={UNIT_FIELD_SUFFIX_CLASS}>
            {HEAT_PUMP_FORM_COPY.consumptionUnit}
          </span>
        </div>
        <FieldError
          id="heatPumpConsumptionKwh-error"
          message={fieldErrors.heatPumpConsumptionKwh}
        />
        <p id={consumptionHelpId} className={FORM_HELP}>
          {HEAT_PUMP_FORM_COPY.consumptionHelp}
        </p>
      </div>
    </div>
  );
}
