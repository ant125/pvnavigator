"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
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
import { EvInputSection } from "./EvInputSection";
import {
  buildAzimuthDropdownOptions,
  buildTiltDropdownOptions,
  DEFAULT_SURFACE,
  parseAzimuthInput,
  parseKwpDecimalInput,
  parseTiltInput,
  pvSurfaceHasCustomExactAngle,
  surfacesOrDefault,
  type PresetDropdownOption,
} from "./calculateFormModel";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FORM_HELP,
  FORM_LABEL,
  FORM_OPTIONAL_BLOCK,
  FORM_PANEL,
  FORM_PANEL_BODY,
  FORM_PANEL_HEAD,
  FORM_RADIO_HINT,
  FORM_RADIO_LABEL,
  FORM_RADIO_OPTION,
  FORM_SECTION_HEADING,
  FORM_SECTIONS,
  FORM_STACK,
  FORM_FIELD,
  FORM_SUBMIT_ZONE,
  fieldInputClassName,
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

function PresetDropdown({
  value,
  options,
  onChange,
  placeholder = "—",
}: {
  value: number | string | "";
  options: PresetDropdownOption[];
  onChange: (value: number) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  const selected = options.find((opt) => opt.value === value);
  const displayLabel = selected?.label ?? placeholder;

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        className={`flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-sm border bg-field px-3 py-1.5 text-left text-ink transition-colors lg:h-9 disabled:cursor-not-allowed disabled:bg-surface-muted ${
          open ? "border-accent" : "border-field-border focus:border-accent"
        }`}
      >
        <span className="min-w-0 whitespace-normal break-words">{displayLabel}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-line bg-surface py-1 shadow-sm [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-surface [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb:hover]:bg-line-strong"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={String(opt.value)} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const n =
                      typeof opt.value === "number"
                        ? opt.value
                        : parseInt(String(opt.value), 10);
                    if (!Number.isFinite(n)) return;
                    onChange(n);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-accent-soft font-medium text-accent-text"
                      : "text-ink hover:bg-surface-muted"
                  }`}
                >
                  <span className="min-w-0 truncate">{opt.label}</span>
                  {isSelected && (
                    <svg
                      className="h-4 w-4 shrink-0 text-accent-text"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 111.42-1.42l2.54 2.54 6.54-6.54a1 1 0 011.42 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FormSection({
  title,
  headingExtra,
  children,
}: {
  title: string;
  headingExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={FORM_PANEL}>
      <div className={FORM_PANEL_HEAD}>
        <h2 className={FORM_SECTION_HEADING}>{title}</h2>
        {headingExtra}
      </div>
      <div className={FORM_PANEL_BODY}>{children}</div>
    </section>
  );
}

function FormHinweis({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <details className="ml-auto min-w-0 shrink-0">
      <summary className="cursor-pointer text-xs font-medium text-ink-muted hover:text-ink">
        Hinweis
      </summary>
      <p id={id} className={`mt-1.5 max-w-reading ${FORM_HELP}`}>
        {children}
      </p>
    </details>
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
  "block w-fit text-sm font-medium text-accent-text hover:text-accent-hover disabled:cursor-not-allowed";

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
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
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
                <div className="relative">
                  <input
                    id={kwpId}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
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
                    className={`${fieldInputClassName(false)} pr-14`}
                    placeholder="z.B. 10"
                  />
                  <span
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-sm text-ink-muted"
                    aria-hidden
                  >
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
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
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
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
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

        <FormSection
          title="Hausverbrauch"
          headingExtra={
            <FormHinweis id="annualConsumptionKwh-hint">
              Ganze kWh zwischen {ANNUAL_CONSUMPTION_KWH_MIN.toLocaleString("de-DE")}{" "}
              und {ANNUAL_CONSUMPTION_KWH_MAX.toLocaleString("de-DE")}.
            </FormHinweis>
          }
        >
          <div className={FORM_FIELD}>
            <label className={FORM_LABEL} htmlFor="annualConsumptionKwh">
              Hausverbrauch (ohne Wärmepumpe) *
            </label>
            <div className="grid min-w-0">
              <input
                ref={fieldInputRefs.annualConsumptionKwh}
                id="annualConsumptionKwh"
                name="annualConsumptionKwh"
                type="number"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                step={1}
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
                className={`${fieldInputClassName(
                  !!fieldErrors.annualConsumptionKwh
                )} col-start-1 row-start-1 pr-[6.5rem]`}
                placeholder="z.B. 4500"
              />
              <span
                id="annualConsumptionKwh-unit"
                className="pointer-events-none col-start-1 row-start-1 mr-3 self-center justify-self-end whitespace-nowrap font-mono text-sm text-ink-muted"
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

        <FormSection title="Wärmepumpe">
          <div className={FORM_OPTIONAL_BLOCK}>
            <fieldset>
              <legend className="text-sm font-medium text-ink">
                Wärmepumpe vorhanden?
              </legend>
              <div className="mt-3 flex flex-col gap-2">
                <label className={FORM_RADIO_LABEL}>
                  <input
                    type="radio"
                    name="heatPumpEnabled"
                    checked={formData.heatPumpEnabled !== true}
                    onChange={() =>
                      setFormData((prev) => ({
                        ...prev,
                        heatPumpEnabled: false,
                        heatPumpConsumptionKwh: undefined,
                        heatPumpTechnology: undefined,
                        heatPumpDhwService: undefined,
                      }))
                    }
                    className="h-4 w-4 shrink-0 border-field-border accent-accent"
                  />
                  Nein
                </label>
                <label className={FORM_RADIO_LABEL}>
                  <input
                    type="radio"
                    name="heatPumpEnabled"
                    checked={formData.heatPumpEnabled === true}
                    onChange={() =>
                      setFormData((prev) => ({
                        ...prev,
                        heatPumpEnabled: true,
                      }))
                    }
                    className="h-4 w-4 shrink-0 border-field-border accent-accent"
                  />
                  Ja
                </label>
              </div>
            </fieldset>

            {formData.heatPumpEnabled === true && (
              <div className="space-y-4 pt-1">
                <fieldset
                  aria-invalid={
                    fieldErrors.heatPumpTechnology ? true : undefined
                  }
                  aria-describedby={
                    fieldErrors.heatPumpTechnology
                      ? "heatPumpTechnology-error"
                      : undefined
                  }
                >
                  <legend className={FORM_LABEL}>Typ der Wärmepumpe</legend>
                  <div className="mt-3 flex flex-col gap-3">
                    <label className={FORM_RADIO_OPTION}>
                      <input
                        type="radio"
                        name="heatPumpTechnology"
                        checked={formData.heatPumpTechnology === "luftwasser"}
                        onChange={() => {
                          clearFieldError("heatPumpTechnology");
                          setFormData((prev) => ({
                            ...prev,
                            heatPumpTechnology: "luftwasser",
                          }));
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 border-field-border accent-accent"
                      />
                      <span>
                        Luft/Wasser
                        <span className={FORM_RADIO_HINT}>
                          Nutzt die Außenluft als Wärmequelle.
                          <br />
                          Häufigste Bauart in Deutschland.
                        </span>
                      </span>
                    </label>
                    <label className={FORM_RADIO_OPTION}>
                      <input
                        type="radio"
                        name="heatPumpTechnology"
                        checked={formData.heatPumpTechnology === "wasserwasser"}
                        onChange={() => {
                          clearFieldError("heatPumpTechnology");
                          clearFieldError("heatPumpDhwService");
                          setFormData((prev) => ({
                            ...prev,
                            heatPumpTechnology: "wasserwasser",
                            heatPumpDhwService:
                              prev.heatPumpDhwService === "space_heat_only"
                                ? undefined
                                : prev.heatPumpDhwService,
                          }));
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 border-field-border accent-accent"
                      />
                      <span>
                        Wasser/Wasser
                        <span className={FORM_RADIO_HINT}>
                          Nutzt Grundwasser bzw. ein kaltes Nahwärmenetz als
                          Wärmequelle.
                        </span>
                      </span>
                    </label>
                  </div>
                  {fieldErrors.heatPumpTechnology && (
                    <p
                      id="heatPumpTechnology-error"
                      className="mt-2 text-xs text-danger"
                    >
                      {fieldErrors.heatPumpTechnology}
                    </p>
                  )}
                </fieldset>

                {formData.heatPumpTechnology === "luftwasser" && (
                  <p className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-muted">
                    <span className="mt-px" aria-hidden>
                      ✓
                    </span>
                    Gemessenes ThermBuild-Referenzprofil
                  </p>
                )}

                {(formData.heatPumpTechnology === "luftwasser" ||
                  formData.heatPumpTechnology === "wasserwasser") && (
                  <fieldset
                    aria-invalid={
                      fieldErrors.heatPumpDhwService ? true : undefined
                    }
                    aria-describedby={
                      fieldErrors.heatPumpDhwService
                        ? "heatPumpDhwService-error"
                        : undefined
                    }
                  >
                    <legend className={FORM_LABEL}>
                      Wofür wird die Wärmepumpe verwendet?
                    </legend>
                    <div className="mt-3 flex flex-col gap-2">
                      {formData.heatPumpTechnology === "luftwasser" && (
                        <label className={FORM_RADIO_LABEL}>
                          <input
                            type="radio"
                            name="heatPumpDhwService"
                            checked={
                              formData.heatPumpDhwService === "space_heat_only"
                            }
                            onChange={() => {
                              clearFieldError("heatPumpDhwService");
                              setFormData((prev) => ({
                                ...prev,
                                heatPumpDhwService: "space_heat_only",
                              }));
                            }}
                            className="h-4 w-4 shrink-0 border-field-border accent-accent"
                          />
                          Nur Heizung
                        </label>
                      )}
                      <label className={FORM_RADIO_LABEL}>
                        <input
                          type="radio"
                          name="heatPumpDhwService"
                          checked={
                            formData.heatPumpDhwService === "space_heat_and_dhw"
                          }
                          onChange={() => {
                            clearFieldError("heatPumpDhwService");
                            setFormData((prev) => ({
                              ...prev,
                              heatPumpDhwService: "space_heat_and_dhw",
                            }));
                          }}
                          className="h-4 w-4 shrink-0 border-field-border accent-accent"
                        />
                        Heizung und Warmwasser
                      </label>
                    </div>
                    {fieldErrors.heatPumpDhwService && (
                      <p
                        id="heatPumpDhwService-error"
                        className="mt-2 text-xs text-danger"
                      >
                        {fieldErrors.heatPumpDhwService}
                      </p>
                    )}
                  </fieldset>
                )}

                <div className="space-y-2">
                  <label className={FORM_LABEL} htmlFor="heatPumpConsumptionKwh">
                    Stromverbrauch Wärmepumpe (kWh/Jahr)
                  </label>
                  <input
                    id="heatPumpConsumptionKwh"
                    type="number"
                    name="heatPumpConsumptionKwh"
                    min="1"
                    value={formData.heatPumpConsumptionKwh ?? ""}
                    onChange={(e) => {
                      clearFieldError("heatPumpConsumptionKwh");
                      setFormData((prev) => ({
                        ...prev,
                        heatPumpConsumptionKwh:
                          parseInt(e.target.value, 10) || undefined,
                      }));
                    }}
                    aria-invalid={
                      fieldErrors.heatPumpConsumptionKwh ? true : undefined
                    }
                    aria-describedby={
                      fieldErrors.heatPumpConsumptionKwh
                        ? "heatPumpConsumptionKwh-error"
                        : undefined
                    }
                    className={fieldInputClassName(
                      !!fieldErrors.heatPumpConsumptionKwh
                    )}
                    placeholder="z. B. 5000"
                  />
                  {fieldErrors.heatPumpConsumptionKwh && (
                    <p
                      id="heatPumpConsumptionKwh-error"
                      className="text-xs text-danger"
                    >
                      {fieldErrors.heatPumpConsumptionKwh}
                    </p>
                  )}
                  <p className={FORM_HELP}>
                    Falls vorhanden: separater Stromverbrauch Ihrer Wärmepumpe.
                  </p>
                </div>
              </div>
            )}
            <p className={FORM_HELP}>
              Viele Haushalte haben mit Wärmepumpe einen deutlich höheren
              Stromverbrauch im Winter. Diese wird hier separat berücksichtigt.
            </p>
          </div>
        </FormSection>

        <FormSection title="Elektroauto">
          <EvInputSection
            formData={formData}
            fieldErrors={fieldErrors}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
            clearFieldError={clearFieldError}
          />
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

      <div className={FORM_SUBMIT_ZONE}>
        {showSubmit ? (
          <button type="submit" className={`${BTN_PRIMARY} w-full`}>
            {submitLabel}
          </button>
        ) : onEditInputs ? (
          <button
            type="button"
            onClick={onEditInputs}
            className={`${BTN_SECONDARY} w-full`}
          >
            Eingaben bearbeiten
          </button>
        ) : locked ? (
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Berechnung läuft …
          </p>
        ) : null}
        <p className={`${FORM_HELP} mt-3`}>
          Pflichtfelder sind mit * gekennzeichnet. Ein abgeschlossener Bericht
          wird in Ihrem Konto gespeichert.
        </p>
        <p className="mt-2">
          <Link
            href="/methodik"
            className="text-sm font-medium text-accent-text hover:text-accent-hover"
          >
            Methodik und Quellen
          </Link>
        </p>
      </div>
    </form>
  );
}
