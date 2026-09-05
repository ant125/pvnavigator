"use client";

import { useState } from "react";
import type { SpeicherInput } from "../types/speicher";
import type {
  SpeicherFieldErrorKey,
  SpeicherFieldErrors,
} from "../utils/validateInput";
import {
  DISABLED_EV_FORM_FIELDS,
  EV_FORM_COPY,
  EV_HOME_CHARGE_POWER_OPTIONS,
  mergeHomeWindow,
  parseEvDecimalInput,
  parseEvIntegerInput,
} from "../utils/evForm";

const FORM_LABEL = "block text-sm font-medium text-ink";
const FORM_HELP = "text-xs leading-relaxed text-ink-muted";
const FORM_OPTIONAL_BLOCK = "space-y-3 rounded-md bg-accent-soft/40 p-4";
const FORM_RADIO_LABEL =
  "flex items-center gap-2 cursor-pointer text-sm text-ink";
const FORM_RADIO_OPTION =
  "flex items-start gap-2 cursor-pointer text-sm text-ink";
const FORM_RADIO_HINT = "mt-0.5 block text-xs leading-relaxed text-ink-muted";
const FORM_GROUP_HEADING =
  "text-xs font-semibold uppercase tracking-wide text-ink";

function fieldInputClassName(hasError: boolean): string {
  return `w-full rounded-md border bg-field px-3.5 py-2.5 text-ink placeholder-ink-muted transition-colors ${
    hasError ? "border-danger" : "border-field-border focus:border-accent"
  }`;
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

function UnitField({
  id,
  label,
  unit,
  help,
  error,
  inputMode,
  value,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  help?: string;
  error?: string;
  inputMode: "numeric" | "decimal";
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const [raw, setRaw] = useState(
    value === undefined || Number.isNaN(value) ? "" : String(value)
  );
  const describedBy = [
    error ? `${id}-error` : null,
    help ? `${id}-help` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-2">
      <label className={FORM_LABEL} htmlFor={id}>
        {label}
      </label>
      <div className="flex min-w-0 items-center gap-3">
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={raw}
          onChange={(e) => {
            const next = e.target.value;
            setRaw(next);
            const parsed =
              inputMode === "numeric"
                ? parseEvIntegerInput(next)
                : parseEvDecimalInput(next);
            onChange(parsed);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`${fieldInputClassName(!!error)} max-w-[12rem]`}
        />
        <span className="shrink-0 text-sm text-ink-secondary">{unit}</span>
      </div>
      <FieldError id={`${id}-error`} message={error} />
      {help && (
        <p id={`${id}-help`} className={FORM_HELP}>
          {help}
        </p>
      )}
    </div>
  );
}

type EvInputSectionProps = {
  formData: Partial<SpeicherInput>;
  fieldErrors: SpeicherFieldErrors;
  onChange: (patch: Partial<SpeicherInput>) => void;
  clearFieldError: (field: SpeicherFieldErrorKey) => void;
};

export function EvInputSection({
  formData,
  fieldErrors,
  onChange,
  clearFieldError,
}: EvInputSectionProps) {
  const evEnabled = formData.evEnabled === true;

  return (
    <div className="border-t border-line pt-8">
      <div className={FORM_OPTIONAL_BLOCK}>
        <fieldset>
          <legend className="text-sm font-medium text-ink">
            {EV_FORM_COPY.enableQuestion}
          </legend>
          <div className="mt-3 flex flex-col gap-2">
            <label className={FORM_RADIO_LABEL}>
              <input
                type="radio"
                name="evEnabled"
                checked={!evEnabled}
                onChange={() => onChange({ ...DISABLED_EV_FORM_FIELDS })}
                className="h-4 w-4 shrink-0 border-field-border accent-accent"
              />
              {EV_FORM_COPY.no}
            </label>
            <label className={FORM_RADIO_LABEL}>
              <input
                type="radio"
                name="evEnabled"
                checked={evEnabled}
                onChange={() => onChange({ evEnabled: true })}
                className="h-4 w-4 shrink-0 border-field-border accent-accent"
              />
              {EV_FORM_COPY.yes}
            </label>
          </div>
        </fieldset>

        {evEnabled && (
          <div className="space-y-8 pt-2">
            <p className="text-sm leading-relaxed text-ink-secondary">
              {EV_FORM_COPY.introLead}
              <br />
              {EV_FORM_COPY.introEffect}
            </p>

            <section className="space-y-4">
              <h3 className={FORM_GROUP_HEADING}>
                {EV_FORM_COPY.vehicleHeading}
              </h3>
              <UnitField
                id="evAnnualKm"
                label={EV_FORM_COPY.annualKmQuestion}
                unit={EV_FORM_COPY.annualKmUnit}
                error={fieldErrors.evAnnualKm}
                inputMode="numeric"
                value={formData.evAnnualKm}
                onChange={(value) => {
                  clearFieldError("evAnnualKm");
                  onChange({ evAnnualKm: value });
                }}
              />
              <UnitField
                id="evConsumptionKwhPer100Km"
                label={EV_FORM_COPY.consumptionQuestion}
                unit={EV_FORM_COPY.consumptionUnit}
                help={EV_FORM_COPY.consumptionHelp}
                error={fieldErrors.evConsumptionKwhPer100Km}
                inputMode="decimal"
                value={formData.evConsumptionKwhPer100Km}
                onChange={(value) => {
                  clearFieldError("evConsumptionKwhPer100Km");
                  onChange({ evConsumptionKwhPer100Km: value });
                }}
              />
              <UnitField
                id="evUsableBatteryCapacityKwh"
                label={EV_FORM_COPY.capacityQuestion}
                unit={EV_FORM_COPY.capacityUnit}
                help={EV_FORM_COPY.capacityHelp}
                error={fieldErrors.evUsableBatteryCapacityKwh}
                inputMode="decimal"
                value={formData.evUsableBatteryCapacityKwh}
                onChange={(value) => {
                  clearFieldError("evUsableBatteryCapacityKwh");
                  onChange({ evUsableBatteryCapacityKwh: value });
                }}
              />
            </section>

            <section className="space-y-4">
              <h3 className={FORM_GROUP_HEADING}>
                {EV_FORM_COPY.typicalHeading}
              </h3>
              <p className={FORM_HELP}>{EV_FORM_COPY.typicalIntro}</p>
              <UnitField
                id="evTypicalDailyKmWd"
                label={EV_FORM_COPY.typicalWdQuestion}
                unit={EV_FORM_COPY.typicalWdUnit}
                error={fieldErrors.evTypicalDailyKmWd}
                inputMode="numeric"
                value={formData.evTypicalDailyKmWd}
                onChange={(value) => {
                  clearFieldError("evTypicalDailyKmWd");
                  onChange({ evTypicalDailyKmWd: value });
                }}
              />
              <UnitField
                id="evTypicalDailyKmSa"
                label={EV_FORM_COPY.typicalSaQuestion}
                unit={EV_FORM_COPY.typicalSaUnit}
                error={fieldErrors.evTypicalDailyKmSa}
                inputMode="numeric"
                value={formData.evTypicalDailyKmSa}
                onChange={(value) => {
                  clearFieldError("evTypicalDailyKmSa");
                  onChange({ evTypicalDailyKmSa: value });
                }}
              />
              <UnitField
                id="evTypicalDailyKmSu"
                label={EV_FORM_COPY.typicalSuQuestion}
                unit={EV_FORM_COPY.typicalSuUnit}
                error={fieldErrors.evTypicalDailyKmSu}
                inputMode="numeric"
                value={formData.evTypicalDailyKmSu}
                onChange={(value) => {
                  clearFieldError("evTypicalDailyKmSu");
                  onChange({ evTypicalDailyKmSu: value });
                }}
              />
            </section>

            <section className="space-y-4">
              <h3 className={FORM_GROUP_HEADING}>{EV_FORM_COPY.homeHeading}</h3>
              <fieldset
                aria-invalid={
                  fieldErrors.evMaxHomeChargePowerKw ? true : undefined
                }
                aria-describedby={
                  fieldErrors.evMaxHomeChargePowerKw
                    ? "evMaxHomeChargePowerKw-error"
                    : "evMaxHomeChargePowerKw-help"
                }
              >
                <legend className={FORM_LABEL}>
                  {EV_FORM_COPY.homePowerQuestion}
                </legend>
                <div className="mt-3 flex flex-col gap-2">
                  {EV_HOME_CHARGE_POWER_OPTIONS.map((opt) => (
                    <label key={opt.kw} className={FORM_RADIO_OPTION}>
                      <input
                        type="radio"
                        name="evMaxHomeChargePowerKw"
                        checked={formData.evMaxHomeChargePowerKw === opt.kw}
                        onChange={() => {
                          clearFieldError("evMaxHomeChargePowerKw");
                          onChange({ evMaxHomeChargePowerKw: opt.kw });
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 border-field-border accent-accent"
                      />
                      <span>
                        {opt.label}
                        {opt.note && (
                          <span className={FORM_RADIO_HINT}>{opt.note}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                <FieldError
                  id="evMaxHomeChargePowerKw-error"
                  message={fieldErrors.evMaxHomeChargePowerKw}
                />
                <p id="evMaxHomeChargePowerKw-help" className={`mt-2 ${FORM_HELP}`}>
                  {EV_FORM_COPY.homePowerHelp}
                </p>
              </fieldset>

              <fieldset>
                <legend className={FORM_LABEL}>
                  {EV_FORM_COPY.homeWindowQuestion}
                </legend>
                <p className={`mt-2 ${FORM_HELP}`}>
                  {EV_FORM_COPY.homeWindowHelp}
                </p>
                <div className="mt-4 space-y-5">
                  <HomeWindowRow
                    dayKey="evHomeWindowWd"
                    label={EV_FORM_COPY.weekdayRow}
                    window={formData.evHomeWindowWd}
                    error={fieldErrors.evHomeWindowWd}
                    onChange={onChange}
                    clearFieldError={clearFieldError}
                  />
                  <HomeWindowRow
                    dayKey="evHomeWindowSa"
                    label={EV_FORM_COPY.saturdayRow}
                    window={formData.evHomeWindowSa}
                    error={fieldErrors.evHomeWindowSa}
                    onChange={onChange}
                    clearFieldError={clearFieldError}
                  />
                  <HomeWindowRow
                    dayKey="evHomeWindowSu"
                    label={EV_FORM_COPY.sundayRow}
                    window={formData.evHomeWindowSu}
                    error={fieldErrors.evHomeWindowSu}
                    onChange={onChange}
                    clearFieldError={clearFieldError}
                  />
                </div>
              </fieldset>
            </section>

            <section className="space-y-4">
              <h3 className={FORM_GROUP_HEADING}>
                {EV_FORM_COPY.workplaceHeading}
              </h3>
              <fieldset
                aria-invalid={
                  fieldErrors.evWorkplaceEnabled ? true : undefined
                }
                aria-describedby={
                  fieldErrors.evWorkplaceEnabled
                    ? "evWorkplaceEnabled-error"
                    : undefined
                }
              >
                <legend className={FORM_LABEL}>
                  {EV_FORM_COPY.workplaceQuestion}
                </legend>
                <div className="mt-3 flex flex-col gap-2">
                  <label className={FORM_RADIO_LABEL}>
                    <input
                      type="radio"
                      name="evWorkplaceEnabled"
                      checked={formData.evWorkplaceEnabled === false}
                      onChange={() => {
                        clearFieldError("evWorkplaceEnabled");
                        clearFieldError("evWorkplaceKwhPerMonth");
                        clearFieldError("evWorkplaceChargingDaysPerMonth");
                        onChange({
                          evWorkplaceEnabled: false,
                          evWorkplaceKwhPerMonth: undefined,
                          evWorkplaceChargingDaysPerMonth: undefined,
                        });
                      }}
                      className="h-4 w-4 shrink-0 border-field-border accent-accent"
                    />
                    {EV_FORM_COPY.no}
                  </label>
                  <label className={FORM_RADIO_LABEL}>
                    <input
                      type="radio"
                      name="evWorkplaceEnabled"
                      checked={formData.evWorkplaceEnabled === true}
                      onChange={() => {
                        clearFieldError("evWorkplaceEnabled");
                        onChange({ evWorkplaceEnabled: true });
                      }}
                      className="h-4 w-4 shrink-0 border-field-border accent-accent"
                    />
                    {EV_FORM_COPY.yes}
                  </label>
                </div>
                <FieldError
                  id="evWorkplaceEnabled-error"
                  message={fieldErrors.evWorkplaceEnabled}
                />
              </fieldset>

              {formData.evWorkplaceEnabled === true && (
                <div className="space-y-4">
                  <UnitField
                    id="evWorkplaceKwhPerMonth"
                    label={EV_FORM_COPY.workplaceEnergyQuestion}
                    unit={EV_FORM_COPY.workplaceEnergyUnit}
                    help={EV_FORM_COPY.workplaceEnergyHelp}
                    error={fieldErrors.evWorkplaceKwhPerMonth}
                    inputMode="decimal"
                    value={formData.evWorkplaceKwhPerMonth}
                    onChange={(value) => {
                      clearFieldError("evWorkplaceKwhPerMonth");
                      onChange({ evWorkplaceKwhPerMonth: value });
                    }}
                  />
                  <UnitField
                    id="evWorkplaceChargingDaysPerMonth"
                    label={EV_FORM_COPY.workplaceDaysQuestion}
                    unit={EV_FORM_COPY.workplaceDaysUnit}
                    help={EV_FORM_COPY.workplaceDaysHelp}
                    error={fieldErrors.evWorkplaceChargingDaysPerMonth}
                    inputMode="numeric"
                    value={formData.evWorkplaceChargingDaysPerMonth}
                    onChange={(value) => {
                      clearFieldError("evWorkplaceChargingDaysPerMonth");
                      onChange({ evWorkplaceChargingDaysPerMonth: value });
                    }}
                  />
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function HomeWindowRow({
  dayKey,
  label,
  window,
  error,
  onChange,
  clearFieldError,
}: {
  dayKey: "evHomeWindowWd" | "evHomeWindowSa" | "evHomeWindowSu";
  label: string;
  window: SpeicherInput["evHomeWindowWd"];
  error?: string;
  onChange: (patch: Partial<SpeicherInput>) => void;
  clearFieldError: (field: SpeicherFieldErrorKey) => void;
}) {
  const fullDay = window?.fullDay === true;
  const startId = `${dayKey}-start`;
  const endId = `${dayKey}-end`;

  const updateWindow = (patch: {
    fullDay?: boolean;
    start?: string;
    end?: string;
  }) => {
    clearFieldError(dayKey);
    onChange({ [dayKey]: mergeHomeWindow(window, patch) });
  };

  return (
    <div className="space-y-3 rounded-md border border-line-soft bg-surface p-3 sm:p-4">
      <p className="text-sm font-medium text-ink">{label}</p>
      <label className={FORM_RADIO_LABEL}>
        <input
          type="checkbox"
          checked={fullDay}
          onChange={(e) =>
            updateWindow({
              fullDay: e.target.checked,
              start: e.target.checked ? "" : window?.start ?? "",
              end: e.target.checked ? "" : window?.end ?? "",
            })
          }
          className="h-4 w-4 shrink-0 rounded border-field-border accent-accent"
        />
        {EV_FORM_COPY.fullDayLabel}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={FORM_LABEL} htmlFor={startId}>
            {EV_FORM_COPY.fromLabel}
          </label>
          <input
            id={startId}
            type="time"
            step={900}
            required={!fullDay}
            disabled={fullDay}
            value={fullDay ? "" : window?.start ?? ""}
            onChange={(e) => updateWindow({ start: e.target.value })}
            aria-invalid={error && !fullDay ? true : undefined}
            aria-describedby={error ? `${dayKey}-error` : undefined}
            className={fieldInputClassName(!!error && !fullDay)}
          />
        </div>
        <div className="space-y-1.5">
          <label className={FORM_LABEL} htmlFor={endId}>
            {EV_FORM_COPY.toLabel}
          </label>
          <input
            id={endId}
            type="time"
            step={900}
            required={!fullDay}
            disabled={fullDay}
            value={fullDay ? "" : window?.end ?? ""}
            onChange={(e) => updateWindow({ end: e.target.value })}
            aria-invalid={error && !fullDay ? true : undefined}
            aria-describedby={error ? `${dayKey}-error` : undefined}
            className={fieldInputClassName(!!error && !fullDay)}
          />
        </div>
      </div>
      <FieldError id={`${dayKey}-error`} message={error} />
    </div>
  );
}
