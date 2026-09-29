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
  isEvHomeChargePowerKw,
  mergeHomeWindow,
  parseEvDecimalInput,
  parseEvIntegerInput,
} from "../utils/evForm";
import { PresetDropdown } from "./PresetDropdown";
import {
  FORM_ADDON_BG,
  FORM_GROUP_HEADING,
  FORM_HELP,
  FORM_LABEL,
  FORM_RADIO_LABEL,
  quantityInputProps,
  UNIT_FIELD_INPUT_CLASS,
  UNIT_FIELD_SUFFIX_CLASS,
  suppressPointerFocus,
  unitFieldControlClassName,
} from "./formStyles";

function homeWindowTimeClassName(hasError: boolean): string {
  return `sg-ev-time h-11 w-full min-w-0 border-0 bg-transparent px-2 py-1.5 text-ink outline-none lg:h-9 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ink/70 disabled:opacity-100 ${
    hasError ? "text-danger" : ""
  }`;
}

function homeWindowCellClassName(options: {
  header?: boolean;
  tag?: boolean;
  last?: boolean;
  flush?: boolean;
}): string {
  const { header = false, tag = false, last = false, flush = false } = options;
  const bottom = last ? "" : "border-b border-line ";
  const tone = header || tag ? FORM_ADDON_BG : "bg-field";
  const type = header
    ? "text-xs font-medium text-ink-muted"
    : "text-sm text-ink";
  const pad = flush ? "" : header ? "px-2 py-1.5" : "px-2";
  return `${bottom}min-w-0 ${tone} ${type} ${pad}`.trim();
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
  ariaLabel,
  describedBy,
}: {
  id: string;
  label: string;
  unit: string;
  help?: string;
  error?: string;
  inputMode: "numeric" | "decimal";
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  ariaLabel?: string;
  describedBy?: string;
}) {
  const [raw, setRaw] = useState(
    value === undefined || Number.isNaN(value) ? "" : String(value)
  );
  const helpId = help ? `${id}-help` : null;
  const unitId = `${id}-unit`;
  const describedByIds = [
    unitId,
    error ? `${id}-error` : null,
    describedBy ?? null,
    helpId,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-w-0 space-y-1">
      <label className={FORM_LABEL} htmlFor={id}>
        {label}
      </label>
      <div className={unitFieldControlClassName(!!error)}>
        <input
          id={id}
          {...quantityInputProps(inputMode)}
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
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds || undefined}
          className={UNIT_FIELD_INPUT_CLASS}
        />
        <span
          id={unitId}
          className={UNIT_FIELD_SUFFIX_CLASS}
        >
          {unit}
        </span>
      </div>
      <FieldError id={`${id}-error`} message={error} />
      {help ? (
        <p id={helpId ?? undefined} className={FORM_HELP}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function patchForEvEnabled(enabled: boolean): Partial<SpeicherInput> {
  return enabled ? { evEnabled: true } : { ...DISABLED_EV_FORM_FIELDS };
}

export function EvEnableToggle({
  evEnabled,
  onChange,
}: {
  evEnabled: boolean;
  onChange: (patch: Partial<SpeicherInput>) => void;
}) {
  return (
    <fieldset className="ml-auto shrink-0 self-center">
      <legend className="sr-only">{EV_FORM_COPY.enableQuestion}</legend>
      <div className="flex items-center gap-3">
        <label className={FORM_RADIO_LABEL} onMouseDown={suppressPointerFocus}>
          <input
            type="radio"
            name="evEnabled"
            checked={!evEnabled}
            onChange={() => onChange(patchForEvEnabled(false))}
            className="h-4 w-4 shrink-0 border-field-border accent-accent"
          />
          {EV_FORM_COPY.no}
        </label>
        <label className={FORM_RADIO_LABEL} onMouseDown={suppressPointerFocus}>
          <input
            type="radio"
            name="evEnabled"
            checked={evEnabled}
            onChange={() => onChange(patchForEvEnabled(true))}
            className="h-4 w-4 shrink-0 border-field-border accent-accent"
          />
          {EV_FORM_COPY.yes}
        </label>
      </div>
    </fieldset>
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
  const typicalHelpId = "ev-typical-km-help";
  const homeWindowHelpId = "ev-home-window-help";
  const homeWindowOvernightId = "ev-home-window-overnight-help";

  return (
    <div className="@container min-w-0 space-y-field-group-gap">
      <div className="grid grid-cols-1 gap-3 @min-[18rem]:grid-cols-2">
        <UnitField
          id="evAnnualKm"
          label={EV_FORM_COPY.annualKmLabel}
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
          label={EV_FORM_COPY.consumptionLabel}
          unit={EV_FORM_COPY.consumptionUnit}
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
          label={EV_FORM_COPY.capacityLabel}
          unit={EV_FORM_COPY.capacityUnit}
          error={fieldErrors.evUsableBatteryCapacityKwh}
          inputMode="decimal"
          value={formData.evUsableBatteryCapacityKwh}
          onChange={(value) => {
            clearFieldError("evUsableBatteryCapacityKwh");
            onChange({ evUsableBatteryCapacityKwh: value });
          }}
        />
      </div>

      <section className="space-y-3">
        <h3 className={FORM_GROUP_HEADING}>{EV_FORM_COPY.typicalHeading}</h3>
        <p id={typicalHelpId} className={FORM_HELP}>
          {EV_FORM_COPY.typicalIntro}
        </p>
        <div className="grid grid-cols-1 gap-3 @min-[18rem]:grid-cols-3">
          <UnitField
            id="evTypicalDailyKmWd"
            label={EV_FORM_COPY.typicalWdLabel}
            unit={EV_FORM_COPY.typicalKmUnit}
            error={fieldErrors.evTypicalDailyKmWd}
            inputMode="numeric"
            value={formData.evTypicalDailyKmWd}
            ariaLabel={EV_FORM_COPY.typicalWdAria}
            describedBy={typicalHelpId}
            onChange={(value) => {
              clearFieldError("evTypicalDailyKmWd");
              onChange({ evTypicalDailyKmWd: value });
            }}
          />
          <UnitField
            id="evTypicalDailyKmSa"
            label={EV_FORM_COPY.typicalSaLabel}
            unit={EV_FORM_COPY.typicalKmUnit}
            error={fieldErrors.evTypicalDailyKmSa}
            inputMode="numeric"
            value={formData.evTypicalDailyKmSa}
            ariaLabel={EV_FORM_COPY.typicalSaAria}
            describedBy={typicalHelpId}
            onChange={(value) => {
              clearFieldError("evTypicalDailyKmSa");
              onChange({ evTypicalDailyKmSa: value });
            }}
          />
          <UnitField
            id="evTypicalDailyKmSu"
            label={EV_FORM_COPY.typicalSuLabel}
            unit={EV_FORM_COPY.typicalKmUnit}
            error={fieldErrors.evTypicalDailyKmSu}
            inputMode="numeric"
            value={formData.evTypicalDailyKmSu}
            ariaLabel={EV_FORM_COPY.typicalSuAria}
            describedBy={typicalHelpId}
            onChange={(value) => {
              clearFieldError("evTypicalDailyKmSu");
              onChange({ evTypicalDailyKmSu: value });
            }}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className={FORM_GROUP_HEADING}>{EV_FORM_COPY.homeHeading}</h3>
        <div className="min-w-0 space-y-1">
          <label className={FORM_LABEL} htmlFor="evMaxHomeChargePowerKw">
            {EV_FORM_COPY.homePowerLabel}
          </label>
          <PresetDropdown
            id="evMaxHomeChargePowerKw"
            value={formData.evMaxHomeChargePowerKw ?? ""}
            placeholder={EV_FORM_COPY.homePowerPlaceholder}
            hasError={!!fieldErrors.evMaxHomeChargePowerKw}
            describedBy={
              fieldErrors.evMaxHomeChargePowerKw
                ? "evMaxHomeChargePowerKw-error"
                : undefined
            }
            options={EV_HOME_CHARGE_POWER_OPTIONS.map((opt) => ({
              value: opt.kw,
              label: opt.label,
              description: opt.note,
            }))}
            onChange={(n) => {
              clearFieldError("evMaxHomeChargePowerKw");
              if (!isEvHomeChargePowerKw(n)) return;
              onChange({ evMaxHomeChargePowerKw: n });
            }}
          />
          <FieldError
            id="evMaxHomeChargePowerKw-error"
            message={fieldErrors.evMaxHomeChargePowerKw}
          />
        </div>

        <div className="min-w-0 space-y-2">
          <p id="ev-home-window-label" className={FORM_LABEL}>
            {EV_FORM_COPY.homeWindowLabel}
          </p>
          <div
            role="table"
            aria-labelledby="ev-home-window-label"
            aria-describedby={`${homeWindowOvernightId} ${homeWindowHelpId}`}
            className="overflow-hidden rounded-sm border border-field-border"
          >
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
              <div role="row" className="contents">
                <div
                  role="columnheader"
                  className={homeWindowCellClassName({ header: true, tag: true })}
                >
                  {EV_FORM_COPY.homeWindowTagLabel}
                </div>
                <div
                  role="columnheader"
                  className={`border-l border-line ${homeWindowCellClassName({ header: true })}`}
                >
                  {EV_FORM_COPY.fromLabel}
                </div>
                <div
                  role="columnheader"
                  className={`border-l border-line ${homeWindowCellClassName({ header: true })}`}
                >
                  {EV_FORM_COPY.toLabel}
                </div>
              </div>
              <HomeWindowRow
                dayKey="evHomeWindowWd"
                label={EV_FORM_COPY.weekdayRow}
                ariaDay={EV_FORM_COPY.weekdayAria}
                window={formData.evHomeWindowWd}
                error={fieldErrors.evHomeWindowWd}
                describedBy={`${homeWindowOvernightId} ${homeWindowHelpId}`}
                onChange={onChange}
                clearFieldError={clearFieldError}
              />
              <HomeWindowRow
                dayKey="evHomeWindowSa"
                label={EV_FORM_COPY.saturdayRow}
                ariaDay={EV_FORM_COPY.saturdayAria}
                window={formData.evHomeWindowSa}
                error={fieldErrors.evHomeWindowSa}
                describedBy={`${homeWindowOvernightId} ${homeWindowHelpId}`}
                onChange={onChange}
                clearFieldError={clearFieldError}
              />
              <HomeWindowRow
                dayKey="evHomeWindowSu"
                label={EV_FORM_COPY.sundayRow}
                ariaDay={EV_FORM_COPY.sundayAria}
                window={formData.evHomeWindowSu}
                error={fieldErrors.evHomeWindowSu}
                describedBy={`${homeWindowOvernightId} ${homeWindowHelpId}`}
                onChange={onChange}
                clearFieldError={clearFieldError}
                last
              />
            </div>
          </div>
          <p id={homeWindowOvernightId} className={FORM_HELP}>
            {EV_FORM_COPY.homeWindowOvernightHelp}
          </p>
          <p id={homeWindowHelpId} className={FORM_HELP}>
            {EV_FORM_COPY.homeWindowHelp}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
            <legend className="sr-only">{EV_FORM_COPY.workplaceQuestion}</legend>
            <div className="flex items-center gap-3">
              <label className={FORM_RADIO_LABEL} onMouseDown={suppressPointerFocus}>
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
              <label className={FORM_RADIO_LABEL} onMouseDown={suppressPointerFocus}>
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
        </div>

        {formData.evWorkplaceEnabled === true && (
          <div className="grid grid-cols-1 gap-3 @min-[18rem]:grid-cols-2">
            <UnitField
              id="evWorkplaceKwhPerMonth"
              label={EV_FORM_COPY.workplaceEnergyLabel}
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
              label={EV_FORM_COPY.workplaceDaysLabel}
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
  );
}

function HomeWindowRow({
  dayKey,
  label,
  ariaDay,
  window,
  error,
  describedBy,
  onChange,
  clearFieldError,
  last = false,
}: {
  dayKey: "evHomeWindowWd" | "evHomeWindowSa" | "evHomeWindowSu";
  label: string;
  ariaDay: string;
  window: SpeicherInput["evHomeWindowWd"];
  error?: string;
  describedBy?: string;
  onChange: (patch: Partial<SpeicherInput>) => void;
  clearFieldError: (field: SpeicherFieldErrorKey) => void;
  last?: boolean;
}) {
  const startId = `${dayKey}-start`;
  const endId = `${dayKey}-end`;
  const errorId = `${dayKey}-error`;
  const describedByIds = [describedBy, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  const updateWindow = (patch: { start?: string; end?: string }) => {
    clearFieldError(dayKey);
    onChange({ [dayKey]: mergeHomeWindow(window, patch) });
  };

  const lastWithoutError = last && !error;

  return (
    <div role="row" className="contents">
      <div
        role="rowheader"
        className={`flex items-center whitespace-nowrap ${homeWindowCellClassName({
          tag: true,
          last: lastWithoutError,
        })}`}
      >
        {label}
      </div>
      <div
        role="cell"
        className={`border-l border-line ${homeWindowCellClassName({
          last: lastWithoutError,
          flush: true,
        })}`}
      >
        <input
          id={startId}
          type="time"
          step={900}
          required
          value={window?.start ?? ""}
          onChange={(e) => updateWindow({ start: e.target.value })}
          aria-label={`${ariaDay} ${EV_FORM_COPY.fromLabel.toLowerCase()}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds || undefined}
          className={homeWindowTimeClassName(!!error)}
        />
      </div>
      <div
        role="cell"
        className={`border-l border-line ${homeWindowCellClassName({
          last: lastWithoutError,
          flush: true,
        })}`}
      >
        <input
          id={endId}
          type="time"
          step={900}
          required
          value={window?.end ?? ""}
          onChange={(e) => updateWindow({ end: e.target.value })}
          aria-label={`${ariaDay} ${EV_FORM_COPY.toLabel.toLowerCase()}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds || undefined}
          className={homeWindowTimeClassName(!!error)}
        />
      </div>
      {error ? (
        <div
          role="cell"
          className={`col-span-3 px-2 py-1 ${last ? "" : "border-b border-line"}`}
        >
          <FieldError id={errorId} message={error} />
        </div>
      ) : null}
    </div>
  );
}
