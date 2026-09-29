"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { PvSurfaceInput, SpeicherInput } from "../types/speicher";
import {
  pvSurfaceHasInvalidExactAngle,
  type SpeicherFieldErrorKey,
  type SpeicherFieldErrors,
} from "../utils/validateInput";
import {
  ANNUAL_CONSUMPTION_KWH_MAX,
  ANNUAL_CONSUMPTION_KWH_MIN,
  parseAnnualConsumptionInput,
} from "../utils/annualConsumption";
import { EvEnableToggle, EvInputSection } from "./EvInputSection";
import {
  HeatPumpEnableToggle,
  HeatPumpInputSection,
} from "./HeatPumpInputSection";
import {
  buildAzimuthDropdownOptions,
  buildTiltDropdownOptions,
  DEFAULT_SURFACE,
  parseAzimuthInput,
  parseKwpDecimalInput,
  parseTiltInput,
  pvSurfaceHasCustomExactAngle,
  surfacesOrDefault,
} from "./calculateFormModel";
import { PresetDropdown } from "./PresetDropdown";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FORM_HELP,
  FORM_LABEL,
  FORM_OPTIONAL_BLOCK,
  FORM_PANEL,
  FORM_PANEL_BODY,
  FORM_PANEL_HEAD,
  FORM_SECTION_HEADING,
  FORM_SECTIONS,
  FORM_STACK,
  FORM_FIELD,
  FORM_SUBMIT_ZONE,
  fieldInputClassName,
  quantityInputProps,
  UNIT_FIELD_INPUT_CLASS,
  UNIT_FIELD_SUFFIX_CLASS,
  suppressPointerFocus,
  unitFieldControlClassName,
} from "./formStyles";

const BACKUP_RESERVE_RADIO_OPTIONS: ReadonlyArray<{
  kwh: number;
  label: string;
  recommended?: boolean;
}> = [
  { kwh: 1.5, label: "1.5 kWh" },
  { kwh: 2.0, label: "2.0 kWh", recommended: true },
  { kwh: 3.0, label: "3.0 kWh" },
];

function FormSection({
  title,
  headingExtra,
  children,
}: {
  title: string;
  headingExtra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className={FORM_PANEL}>
      <div className={FORM_PANEL_HEAD}>
        <h2 className={FORM_SECTION_HEADING}>{title}</h2>
        {headingExtra}
      </div>
      {children != null && children !== false ? (
        <div className={FORM_PANEL_BODY}>{children}</div>
      ) : null}
    </section>
  );
}

export function exactAnglesForcedOpen(
  surface: PvSurfaceInput,
  locked: boolean,
  hasFormErrors: boolean
): boolean {
  const invalid = pvSurfaceHasInvalidExactAngle(surface);
  if (hasFormErrors && invalid) return true;
  return (
    locked && (invalid || pvSurfaceHasCustomExactAngle(surface))
  );
}

const PV_PLANE_ACTION =
  "block w-fit text-sm font-medium text-accent-text hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-100";

export const FOCUS_FIELD_ORDER = [
  "postalCode",
  "city",
  "street",
  "houseNumber",
  "annualConsumptionKwh",
] as const;

export type CalculateFormFieldRefs = Record<
  (typeof FOCUS_FIELD_ORDER)[number],
  RefObject<HTMLInputElement | null>
>;

export type SpeicherCalculateFormProps = {
  formData: Partial<SpeicherInput>;
  setFormData: (
    updater:
      | Partial<SpeicherInput>
      | ((prev: Partial<SpeicherInput>) => Partial<SpeicherInput>)
  ) => void;
  kwpInputStrings: string[];
  setKwpInputStrings: (updater: string[] | ((prev: string[]) => string[])) => void;
  azimuthInputStrings: string[];
  setAzimuthInputStrings: (
    updater: string[] | ((prev: string[]) => string[])
  ) => void;
  tiltInputStrings: string[];
  setTiltInputStrings: (updater: string[] | ((prev: string[]) => string[])) => void;
  errors: string[];
  fieldErrors: SpeicherFieldErrors;
  clearFieldError: (field: SpeicherFieldErrorKey) => void;
  locked: boolean;
  submitLabel: string;
  showSubmit: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onEditInputs?: () => void;
  /** Result panel: the field list is the only scrollport. */
  fieldsScrollable?: boolean;
  errorBoxRef: RefObject<HTMLDivElement | null>;
  fieldInputRefs: CalculateFormFieldRefs;
};

export function SpeicherCalculateForm({
  formData,
  setFormData,
  kwpInputStrings,
  setKwpInputStrings,
  azimuthInputStrings,
  setAzimuthInputStrings,
  tiltInputStrings,
  setTiltInputStrings,
  errors,
  fieldErrors,
  clearFieldError,
  locked,
  submitLabel,
  showSubmit,
  onSubmit,
  onEditInputs,
  fieldsScrollable = false,
  errorBoxRef,
  fieldInputRefs,
}: SpeicherCalculateFormProps) {
  const surfaces = surfacesOrDefault(formData);
  const [exactAnglesOpen, setExactAnglesOpen] = useState<boolean[]>(() =>
    surfaces.map(() => false)
  );

  useEffect(() => {
    setExactAnglesOpen((prev) => {
      if (prev.length === surfaces.length) return prev;
      if (prev.length < surfaces.length) {
        return [...prev, ...Array(surfaces.length - prev.length).fill(false)];
      }
      return prev.slice(0, surfaces.length);
    });
  }, [surfaces.length]);

  /*
    Unlocking moves the caret into the first field. Without it the submit
    button that replaces "Eingaben bearbeiten" would sit focused under the
    pointer, one Enter or Space away from an unwanted run.
  */
  const focusFirstFieldRef = useRef(false);
  useEffect(() => {
    if (locked || !focusFirstFieldRef.current) return;
    focusFirstFieldRef.current = false;
    fieldInputRefs.postalCode.current?.focus({ preventScroll: true });
  }, [locked, fieldInputRefs]);

  const updateSurface = (
    planeIndex: number,
    patch: Partial<PvSurfaceInput>
  ) => {
    setFormData((prev) => {
      const list = [...surfacesOrDefault(prev)];
      list[planeIndex] = { ...list[planeIndex], ...patch };
      return { ...prev, pvSurfaces: list };
    });
  };

  const addSurface = () => {
    setKwpInputStrings((prev) => [...prev, ""]);
    setAzimuthInputStrings((prev) => [
      ...prev,
      String(DEFAULT_SURFACE.azimuthDeg),
    ]);
    setTiltInputStrings((prev) => [...prev, String(DEFAULT_SURFACE.tiltDeg)]);
    setExactAnglesOpen((prev) => [...prev, false]);
    setFormData((prev) => ({
      ...prev,
      pvSurfaces: [
        ...surfacesOrDefault(prev),
        {
          systemSizeKwP: NaN,
          tiltDeg: 30,
          azimuthDeg: 180,
        },
      ],
    }));
  };

  const removeSurface = (planeIndex: number) => {
    if (planeIndex <= 0) return;
    setKwpInputStrings((prev) => prev.filter((_, i) => i !== planeIndex));
    setAzimuthInputStrings((prev) => prev.filter((_, i) => i !== planeIndex));
    setTiltInputStrings((prev) => prev.filter((_, i) => i !== planeIndex));
    setExactAnglesOpen((prev) => prev.filter((_, i) => i !== planeIndex));
    setFormData((prev) => {
      const list = surfacesOrDefault(prev).filter((_, i) => i !== planeIndex);
      return {
        ...prev,
        pvSurfaces: list.length > 0 ? list : [{ ...DEFAULT_SURFACE }],
      };
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="sg-calculate-form space-y-6"
      noValidate
    >
      {errors.length > 0 && (
        <div
          ref={errorBoxRef}
          role="alert"
          aria-live="polite"
          className="rounded-sm border border-danger/40 bg-danger-soft p-4"
        >
          <p className="mb-2 text-sm font-semibold text-danger">
            Bitte korrigieren Sie folgende Fehler:
          </p>
          <ul className="list-disc list-inside text-sm text-danger">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/*
        The scrollport is this plain div, not the fieldset: a fieldset as a
        flex item does not reliably hand its constrained height to children,
        so the fields would grow past the panel and slide under the footer.
      */}
      <div
        className="sg-form-fields min-w-0"
        tabIndex={fieldsScrollable ? 0 : undefined}
        role={fieldsScrollable ? "region" : undefined}
        aria-label={fieldsScrollable ? "Eingabefelder" : undefined}
      >
      <fieldset
        disabled={locked}
        className={`min-w-0 border-0 p-0 ${
          locked ? "[&_label]:cursor-default" : ""
        }`}
      >
        <legend className="sr-only">Eingabedaten der Speicher-Analyse</legend>

        <div className={FORM_SECTIONS}>
        <FormSection title="Standort">
          <div className={`${FORM_STACK} min-w-0 @container`}>
          <div className="grid min-w-0 grid-cols-1 gap-x-2 gap-y-3 @min-[16rem]:grid-cols-2">
            <div className={`${FORM_FIELD} min-w-0`}>
              <label className={FORM_LABEL} htmlFor="postalCode">
                PLZ *
              </label>
              <input
                ref={fieldInputRefs.postalCode}
                id="postalCode"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                value={formData.postalCode ?? ""}
                onChange={(e) => {
                  clearFieldError("postalCode");
                  setFormData((prev) => ({ ...prev, postalCode: e.target.value }));
                }}
                aria-invalid={fieldErrors.postalCode ? true : undefined}
                aria-describedby={
                  fieldErrors.postalCode ? "postalCode-error" : undefined
                }
                className={fieldInputClassName(!!fieldErrors.postalCode)}
                placeholder="z.B. 80331"
              />
              {fieldErrors.postalCode && (
                <p id="postalCode-error" className="text-xs text-danger">
                  {fieldErrors.postalCode}
                </p>
              )}
            </div>
            <div className={`${FORM_FIELD} min-w-0`}>
              <label className={FORM_LABEL} htmlFor="city">
                Ort *
              </label>
              <input
                ref={fieldInputRefs.city}
                id="city"
                type="text"
                autoComplete="address-level2"
                value={formData.city ?? ""}
                onChange={(e) => {
                  clearFieldError("city");
                  setFormData((prev) => ({ ...prev, city: e.target.value }));
                }}
                aria-invalid={fieldErrors.city ? true : undefined}
                aria-describedby={fieldErrors.city ? "city-error" : undefined}
                className={fieldInputClassName(!!fieldErrors.city)}
                placeholder="z.B. München"
              />
              {fieldErrors.city && (
                <p id="city-error" className="text-xs text-danger">
                  {fieldErrors.city}
                </p>
              )}
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 items-start gap-x-2 gap-y-3 @min-[16rem]:grid-cols-[minmax(0,1fr)_5rem]">
            <div className={`${FORM_FIELD} min-w-0`}>
              <label className={FORM_LABEL} htmlFor="street">
                Straße *
              </label>
              <input
                ref={fieldInputRefs.street}
                id="street"
                type="text"
                autoComplete="street-address"
                value={formData.street ?? ""}
                onChange={(e) => {
                  clearFieldError("street");
                  setFormData((prev) => ({ ...prev, street: e.target.value }));
                }}
                aria-invalid={fieldErrors.street ? true : undefined}
                aria-describedby={fieldErrors.street ? "street-error" : undefined}
                className={fieldInputClassName(!!fieldErrors.street)}
                placeholder="z.B. Marienplatz"
              />
              {fieldErrors.street && (
                <p id="street-error" className="text-xs text-danger">
                  {fieldErrors.street}
                </p>
              )}
            </div>
            <div className={`${FORM_FIELD} min-w-0`}>
              <label className={FORM_LABEL} htmlFor="houseNumber">
                <span className="sr-only">Hausnummer </span>
                Nr. *
              </label>
              <input
                ref={fieldInputRefs.houseNumber}
                id="houseNumber"
                type="text"
                autoComplete="off"
                value={formData.houseNumber ?? ""}
                onChange={(e) => {
                  clearFieldError("houseNumber");
                  setFormData((prev) => ({
                    ...prev,
                    houseNumber: e.target.value,
                  }));
                }}
                aria-invalid={fieldErrors.houseNumber ? true : undefined}
                aria-describedby={
                  fieldErrors.houseNumber ? "houseNumber-error" : undefined
                }
                className={fieldInputClassName(!!fieldErrors.houseNumber)}
                placeholder="z.B. 12a"
              />
              {fieldErrors.houseNumber && (
                <p id="houseNumber-error" className="text-xs text-danger">
                  {fieldErrors.houseNumber}
                </p>
              )}
            </div>
          </div>
          </div>
        </FormSection>

        <FormSection title="PV-Anlage">
          {surfaces.map((surface, planeIndex) => {
            const exactPanelId = `exact-angles-${planeIndex}`;
            const kwpId = `pvLeistung-${planeIndex}`;
            const userOpened = exactAnglesOpen[planeIndex] === true;
            const exactOpen =
              userOpened ||
              exactAnglesForcedOpen(surface, locked, errors.length > 0);
            return (
            <div
              key={planeIndex}
              className={`${FORM_STACK} ${
                planeIndex > 0 ? "border-t border-line pt-3" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-ink">
                  Dachfläche {planeIndex + 1}
                </h3>
                {planeIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => removeSurface(planeIndex)}
                    className={PV_PLANE_ACTION}
                  >
                    Entfernen
                  </button>
                )}
              </div>

              <div className={FORM_FIELD}>
                <label className={FORM_LABEL} htmlFor={kwpId}>
                  PV-Leistung (kWp) *
                </label>
                <div className={unitFieldControlClassName(false)}>
                  <input
                    id={kwpId}
                    {...quantityInputProps("decimal")}
                    value={kwpInputStrings[planeIndex] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setKwpInputStrings((prev) => {
                        const next = [...prev];
                        next[planeIndex] = v;
                        return next;
                      });
                      updateSurface(planeIndex, {
                        systemSizeKwP: parseKwpDecimalInput(v),
                      });
                    }}
                    aria-describedby={`${kwpId}-unit`}
                    className={UNIT_FIELD_INPUT_CLASS}
                    placeholder="z.B. 10"
                  />
                  <span id={`${kwpId}-unit`} className={UNIT_FIELD_SUFFIX_CLASS}>
                    kWp
                  </span>
                </div>
                {planeIndex === 0 && (
                  <p className={FORM_HELP}>
                    Die Größe Ihrer bestehenden oder geplanten PV-Anlage auf
                    dieser Dachfläche.
                  </p>
                )}
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className={`min-w-0 ${FORM_FIELD}`}>
                  <label className={FORM_LABEL}>Dachausrichtung (°)</label>
                  <PresetDropdown
                    value={
                      Number.isFinite(surface.azimuthDeg)
                        ? surface.azimuthDeg
                        : ""
                    }
                    options={buildAzimuthDropdownOptions(surface.azimuthDeg)}
                    onChange={(n) => {
                      setAzimuthInputStrings((prev) => {
                        const next = [...prev];
                        next[planeIndex] = String(n);
                        return next;
                      });
                      updateSurface(planeIndex, { azimuthDeg: n });
                    }}
                  />
                </div>
                <div className={`min-w-0 ${FORM_FIELD}`}>
                  <label className={FORM_LABEL}>Dachneigung (°)</label>
                  <PresetDropdown
                    value={
                      Number.isFinite(surface.tiltDeg) ? surface.tiltDeg : ""
                    }
                    options={buildTiltDropdownOptions(surface.tiltDeg)}
                    onChange={(n) => {
                      setTiltInputStrings((prev) => {
                        const next = [...prev];
                        next[planeIndex] = String(n);
                        return next;
                      });
                      updateSurface(planeIndex, { tiltDeg: n });
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                className={PV_PLANE_ACTION}
                aria-expanded={exactOpen}
                aria-controls={exactPanelId}
                onClick={() =>
                  setExactAnglesOpen((prev) => {
                    const next = [...prev];
                    next[planeIndex] = !exactOpen;
                    return next;
                  })
                }
              >
                {exactOpen
                  ? "Exakte Winkel ausblenden"
                  : "Exakte Winkel anzeigen"}
              </button>

              <div
                id={exactPanelId}
                hidden={!exactOpen}
                className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
              >
                <div className={`min-w-0 ${FORM_FIELD}`}>
                  <label className={FORM_LABEL} htmlFor={`exact-azimut-${planeIndex}`}>
                    Exakter Azimut (°)
                  </label>
                  <input
                    id={`exact-azimut-${planeIndex}`}
                    {...quantityInputProps("numeric")}
                    value={azimuthInputStrings[planeIndex] ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setAzimuthInputStrings((prev) => {
                        const next = [...prev];
                        next[planeIndex] = raw;
                        return next;
                      });
                      const parsed = parseAzimuthInput(raw);
                      updateSurface(planeIndex, {
                        azimuthDeg: parsed.valid ? parsed.deg : NaN,
                      });
                    }}
                    onBlur={() => {
                      const raw = azimuthInputStrings[planeIndex] ?? "";
                      const parsed = parseAzimuthInput(raw);
                      if (!parsed.valid) return;
                      setAzimuthInputStrings((prev) => {
                        const next = [...prev];
                        next[planeIndex] = String(parsed.deg);
                        return next;
                      });
                      updateSurface(planeIndex, { azimuthDeg: parsed.deg });
                    }}
                    className={fieldInputClassName(false)}
                  />
                  <p className={FORM_HELP}>
                    0° = Nord, 90° = Ost, 180° = Süd, 270° = West.
                  </p>
                </div>
                <div className={`min-w-0 ${FORM_FIELD}`}>
                  <label className={FORM_LABEL} htmlFor={`exact-neigung-${planeIndex}`}>
                    Exakte Neigung (°)
                  </label>
                  <input
                    id={`exact-neigung-${planeIndex}`}
                    {...quantityInputProps("numeric")}
                    value={tiltInputStrings[planeIndex] ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setTiltInputStrings((prev) => {
                        const next = [...prev];
                        next[planeIndex] = raw;
                        return next;
                      });
                      const parsed = parseTiltInput(raw);
                      updateSurface(planeIndex, {
                        tiltDeg: parsed.valid ? parsed.deg : NaN,
                      });
                    }}
                    onBlur={() => {
                      const raw = tiltInputStrings[planeIndex] ?? "";
                      const parsed = parseTiltInput(raw);
                      if (!parsed.valid) return;
                      setTiltInputStrings((prev) => {
                        const next = [...prev];
                        next[planeIndex] = String(parsed.deg);
                        return next;
                      });
                      updateSurface(planeIndex, { tiltDeg: parsed.deg });
                    }}
                    className={fieldInputClassName(false)}
                  />
                  <p className={FORM_HELP}>
                    0° = flach, 90° = senkrecht.
                  </p>
                </div>
              </div>
            </div>
            );
          })}

          <button
            type="button"
            onClick={addSurface}
            className={PV_PLANE_ACTION}
          >
            + Dachfläche
          </button>
        </FormSection>

        <FormSection title="Hausverbrauch">
          <div className={FORM_FIELD}>
            <label className={FORM_LABEL} htmlFor="annualConsumptionKwh">
              Hausverbrauch (ohne Wärmepumpe) *
            </label>
            <div
              className={unitFieldControlClassName(
                !!fieldErrors.annualConsumptionKwh
              )}
            >
              <input
                ref={fieldInputRefs.annualConsumptionKwh}
                id="annualConsumptionKwh"
                name="annualConsumptionKwh"
                {...quantityInputProps("numeric")}
                autoCorrect="off"
                spellCheck={false}
                min={ANNUAL_CONSUMPTION_KWH_MIN}
                max={ANNUAL_CONSUMPTION_KWH_MAX}
                value={
                  typeof formData.annualConsumptionKwh === "number" &&
                  Number.isFinite(formData.annualConsumptionKwh)
                    ? formData.annualConsumptionKwh
                    : ""
                }
                onChange={(e) => {
                  clearFieldError("annualConsumptionKwh");
                  setFormData((prev) => ({
                    ...prev,
                    annualConsumptionKwh: parseAnnualConsumptionInput(
                      e.target.value
                    ),
                  }));
                }}
                aria-invalid={
                  fieldErrors.annualConsumptionKwh ? true : undefined
                }
                aria-describedby={
                  fieldErrors.annualConsumptionKwh
                    ? "annualConsumptionKwh-unit annualConsumptionKwh-error"
                    : "annualConsumptionKwh-unit"
                }
                className={UNIT_FIELD_INPUT_CLASS}
                placeholder="z.B. 4500"
              />
              <span
                id="annualConsumptionKwh-unit"
                className={UNIT_FIELD_SUFFIX_CLASS}
              >
                kWh/Jahr
              </span>
            </div>
            {fieldErrors.annualConsumptionKwh && (
              <p id="annualConsumptionKwh-error" className="text-xs text-danger">
                {fieldErrors.annualConsumptionKwh}
              </p>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Wärmepumpe"
          headingExtra={
            <HeatPumpEnableToggle
              heatPumpEnabled={formData.heatPumpEnabled === true}
              onChange={(patch) =>
                setFormData((prev) => ({ ...prev, ...patch }))
              }
            />
          }
        >
          {formData.heatPumpEnabled === true ? (
            <HeatPumpInputSection
              formData={formData}
              fieldErrors={fieldErrors}
              onChange={(patch) =>
                setFormData((prev) => ({ ...prev, ...patch }))
              }
              clearFieldError={clearFieldError}
            />
          ) : null}
        </FormSection>

        <FormSection
          title="Elektroauto"
          headingExtra={
            <EvEnableToggle
              evEnabled={formData.evEnabled === true}
              onChange={(patch) =>
                setFormData((prev) => ({ ...prev, ...patch }))
              }
            />
          }
        >
          {formData.evEnabled === true ? (
            <EvInputSection
              formData={formData}
              fieldErrors={fieldErrors}
              onChange={(patch) =>
                setFormData((prev) => ({ ...prev, ...patch }))
              }
              clearFieldError={clearFieldError}
            />
          ) : null}
        </FormSection>

        <FormSection title="Notstromreserve">
          <div className={FORM_OPTIONAL_BLOCK}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="backupReserveEnabled"
                checked={(formData.backupReserveKwh ?? 0) > 0}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    backupReserveKwh: e.target.checked ? 2 : 0,
                  }))
                }
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-field-border accent-accent"
              />
              <span className="text-sm font-medium text-ink">
                Notstromreserve aktivieren
              </span>
            </label>
            {(formData.backupReserveKwh ?? 0) > 0 && (
              <div className="mt-3 space-y-2 pl-7">
                <span className={`block ${FORM_LABEL}`}>
                  Reservierte Kapazität
                </span>
                <div className="flex flex-col gap-2">
                  {BACKUP_RESERVE_RADIO_OPTIONS.map((opt) => (
                    <label
                      key={opt.kwh}
                      className="flex cursor-pointer items-center gap-2 text-sm text-ink"
                      onMouseDown={suppressPointerFocus}
                    >
                      <input
                        type="radio"
                        name="backupReserveKwhOption"
                        checked={formData.backupReserveKwh === opt.kwh}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            backupReserveKwh: opt.kwh,
                          }))
                        }
                        className="h-4 w-4 shrink-0 border-field-border accent-accent"
                      />
                      <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                        <span className="font-mono tabular-nums">{opt.label}</span>
                        {opt.recommended && (
                          <span className="text-xs font-normal text-accent-text">
                            (empfohlen)
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <p className={FORM_HELP}>
              Ein Teil des Speichers wird für Notfälle reserviert und im Alltag
              nicht genutzt.
              <br />
              Dies reduziert leicht Eigenverbrauch und Autarkie.
            </p>
          </div>
        </FormSection>
        </div>
      </fieldset>
      </div>

      <div className={`${FORM_SUBMIT_ZONE} sg-form-footer`}>
        {!showSubmit && onEditInputs ? (
          <p className="mb-2 text-[11px] leading-[1.4] text-ink-muted">
            Berechnete Eingaben · schreibgeschützt
          </p>
        ) : null}
        {/*
          Distinct keys keep submit and edit on separate DOM nodes. One shared
          node would hand its focus and pressed state to the submit button that
          replaces it, so the next Enter, Space or click would start a run.
        */}
        {showSubmit ? (
          <button key="submit" type="submit" className={`${BTN_PRIMARY} w-full`}>
            {submitLabel}
          </button>
        ) : onEditInputs ? (
          <button
            key="edit"
            type="button"
            onMouseDown={suppressPointerFocus}
            onClick={(event) => {
              event.preventDefault();
              focusFirstFieldRef.current = true;
              onEditInputs();
            }}
            className={`${BTN_SECONDARY} w-full`}
          >
            Eingaben bearbeiten
          </button>
        ) : locked ? (
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Berechnung läuft …
          </p>
        ) : null}
        {!showSubmit && onEditInputs ? null : (
          <p className={`${FORM_HELP} mt-2`}>Dauer ca. 40 Sekunden.</p>
        )}
      </div>
    </form>
  );
}
