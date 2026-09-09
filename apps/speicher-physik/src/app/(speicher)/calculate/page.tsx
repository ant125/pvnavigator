"use client";

import { useState, useEffect, useRef, useCallback, type RefObject } from "react";
import Link from "next/link";
import { SpeicherInput, type PvSurfaceInput } from "../types/speicher";
import { validateInput, type SpeicherFieldErrors, type SpeicherFieldErrorKey } from "../utils/validateInput";
import {
  type HouseholdCalculationPayload,
  type SpeicherGrenzPayload,
  type VerifiedResult,
  type WpuqRobustnessPayload,
  type WwRobustnessPayload,
} from "./actions";
import { CalculationProgressList } from "./CalculationProgressList";
import {
  CALCULATION_COMPLETE_PAUSE_MS,
  INITIAL_CALCULATION_PROGRESS,
  applyCalculationProgress,
} from "@/lib/calculationProgress";
import { runHouseholdCalculationStream } from "./runHouseholdCalculationStream";
import { useReportHeaderCta } from "../components/headerCtaContext";
import { SpeicherReportView } from "../components/SpeicherReportView";
import { EvInputSection } from "./EvInputSection";
import { mapEvFormToCalculationInput } from "../utils/evForm";
import type { ReportHeatPumpCitation } from "@/lib/reportMethodologySources";

/**
 * Speicher Calculator Page
 *
 * URL: speicher.pvnavigator.de/calculate (or /speicher/calculate in development)
 *
 * This is a placeholder calculation flow with mocked results.
 * Real calculations will be implemented in future iterations.
 *
 * FUTURE EXTENSIONS:
 * - Subscription/paywall check before showing results
 * - PDF export of results
 * - Save to user account
 */

type Step = "input" | "calculating" | "results";

const POSTAL_CODE_MISMATCH_GENERAL_MESSAGE =
  "Die eingegebene PLZ stimmt nicht mit der gefundenen Adresse überein. Bitte prüfen Sie die PLZ.";

const FOCUS_FIELD_ORDER = [
  "postalCode",
  "city",
  "street",
  "houseNumber",
  "annualConsumptionKwh",
] as const;

const FORM_LABEL = "block text-sm font-medium text-ink";

const FORM_HELP = "text-xs leading-relaxed text-ink-muted";

/** Input wizard: one sheet on the canvas, narrower than the results document. */
const INPUT_SHEET =
  "rounded-lg border border-line bg-surface p-5 shadow-sm sm:p-8";

/** Form section title — sentence case, not report micro-labels. */
const FORM_SECTION_HEADING = "text-sm font-semibold text-ink";

/** Optional groups (Wärmepumpe, Notstromreserve). */
const FORM_OPTIONAL_BLOCK = "space-y-3 rounded-md bg-accent-soft/40 p-4";

/** Submit band — full bleed to the input sheet edges. */
const FORM_SUBMIT_ZONE =
  "border-t border-line bg-surface-muted -mx-5 px-5 pt-6 sm:-mx-8 sm:px-8";

const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover";

/** Field focus is carried by the global :focus-visible outline plus an accent border. */
function fieldInputClassName(hasError: boolean): string {
  return `w-full rounded-md border bg-field px-3.5 py-2.5 text-ink placeholder-ink-muted transition-colors ${
    hasError ? "border-danger" : "border-field-border focus:border-accent"
  }`;
}

const BACKUP_RESERVE_RADIO_OPTIONS: ReadonlyArray<{
  kwh: number;
  label: string;
  recommended?: boolean;
}> = [
  { kwh: 1.5, label: "1.5 kWh" },
  { kwh: 2.0, label: "2.0 kWh", recommended: true },
  { kwh: 3.0, label: "3.0 kWh" },
];

const FORM_RADIO_LABEL =
  "flex items-center gap-2 cursor-pointer text-sm text-ink";

const FORM_RADIO_OPTION =
  "flex items-start gap-2 cursor-pointer text-sm text-ink";

const FORM_RADIO_HINT = "mt-0.5 block text-xs leading-relaxed text-ink-muted";

/** Cardinal presets for Dachausrichtung (clockwise from Nord). */
const AZIMUTH_PRESET_DEGREES = [
  0, 45, 90, 135, 180, 225, 270, 315,
] as const;

type AzimuthPreset = (typeof AZIMUTH_PRESET_DEGREES)[number];

function isPresetAzimuth(deg: number | undefined): deg is AzimuthPreset {
  return (
    deg !== undefined &&
    (AZIMUTH_PRESET_DEGREES as readonly number[]).includes(deg)
  );
}

const TILT_PRESET_DEGREES = [0, 15, 25, 30, 35, 40, 45, 60] as const;

function isPresetTilt(deg: number | undefined): boolean {
  return (
    deg !== undefined &&
    (TILT_PRESET_DEGREES as readonly number[]).includes(deg)
  );
}

type PresetDropdownOption = {
  value: number | string;
  label: string;
};

const AZIMUTH_PRESET_OPTIONS: PresetDropdownOption[] = [
  { value: 0, label: "Nord (0°)" },
  { value: 45, label: "Nordost (45°)" },
  { value: 90, label: "Ost (90°)" },
  { value: 135, label: "Südost (135°)" },
  { value: 180, label: "Süd (180°)" },
  { value: 225, label: "Südwest (225°)" },
  { value: 270, label: "West (270°)" },
  { value: 315, label: "Nordwest (315°)" },
];

const TILT_PRESET_OPTIONS: PresetDropdownOption[] = [
  { value: 0, label: "Flachdach (0°)" },
  { value: 15, label: "15°" },
  { value: 25, label: "25°" },
  { value: 30, label: "30°" },
  { value: 35, label: "35°" },
  { value: 40, label: "40°" },
  { value: 45, label: "45°" },
  { value: 60, label: "60° (steil)" },
];

function buildAzimuthDropdownOptions(azimuthDeg: number): PresetDropdownOption[] {
  if (Number.isFinite(azimuthDeg) && !isPresetAzimuth(azimuthDeg)) {
    return [
      { value: azimuthDeg, label: `Individuell (${azimuthDeg}°)` },
      ...AZIMUTH_PRESET_OPTIONS,
    ];
  }
  return AZIMUTH_PRESET_OPTIONS;
}

function buildTiltDropdownOptions(tiltDeg: number): PresetDropdownOption[] {
  if (Number.isFinite(tiltDeg) && !isPresetTilt(tiltDeg)) {
    return [
      { value: tiltDeg, label: `Individuell (${tiltDeg}°)` },
      ...TILT_PRESET_OPTIONS,
    ];
  }
  return TILT_PRESET_OPTIONS;
}

const DEFAULT_SURFACE: PvSurfaceInput = {
  systemSizeKwP: NaN,
  tiltDeg: 30,
  azimuthDeg: 180,
};

/**
 * Parse PV kWp text field: accepts German decimal comma or dot.
 * No thousands separators; multiple commas/dots or mixed separators → NaN.
 */
function parseKwpDecimalInput(raw: string): number {
  let s = raw.trim().replace(/ /g, "");
  if (s === "") return NaN;

  const commaCount = (s.match(/,/g) ?? []).length;
  const dotCount = (s.match(/\./g) ?? []).length;
  if (commaCount > 1 || dotCount > 1) return NaN;
  if (commaCount >= 1 && dotCount >= 1) return NaN;

  if (commaCount === 1) {
    s = s.replace(",", ".");
  }

  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return NaN;

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Parse exact azimuth text: whole digits only, 0–359 inclusive; otherwise invalid (NaN). */
function parseAzimuthInput(raw: string): { valid: boolean; deg: number } {
  const s = raw.trim();
  if (s === "") return { valid: false, deg: NaN };
  if (!/^\d+$/.test(s)) return { valid: false, deg: NaN };
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0 || n > 359) return { valid: false, deg: NaN };
  return { valid: true, deg: n };
}

/** Parse exact tilt text: whole digits only, 0–90 inclusive; otherwise invalid (NaN). */
function parseTiltInput(raw: string): { valid: boolean; deg: number } {
  const s = raw.trim();
  if (s === "") return { valid: false, deg: NaN };
  if (!/^\d+$/.test(s)) return { valid: false, deg: NaN };
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0 || n > 90) return { valid: false, deg: NaN };
  return { valid: true, deg: n };
}

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
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-field px-3.5 py-2.5 text-left text-ink transition-colors ${
          open ? "border-accent" : "border-field-border focus:border-accent"
        }`}
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
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
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-sm [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-surface [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb:hover]:bg-line-strong"
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
                  className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition-colors ${
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

function surfacesOrDefault(form: Partial<SpeicherInput>): PvSurfaceInput[] {
  const s = form.pvSurfaces;
  if (s && s.length > 0) return s.map((row) => ({ ...row }));
  return [{ ...DEFAULT_SURFACE }];
}

/** Sum kWp across surfaces — after validation inputs are finite. */
function sumSurfaceKwP(surfaces: PvSurfaceInput[]): number {
  return surfaces.reduce(
    (acc, x) =>
      Number.isFinite(x.systemSizeKwP) ? acc + x.systemSizeKwP : acc,
    0
  );
}

export default function SpeicherCalculatePage() {
  const [step, setStep] = useState<Step>("input");
  const [calculationProgress, setCalculationProgress] = useState(
    INITIAL_CALCULATION_PROGRESS
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [calculationComplete, setCalculationComplete] = useState(false);
  const [calculationDurationMs, setCalculationDurationMs] = useState<
    number | null
  >(null);
  const calculationStartedAtRef = useRef<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<SpeicherFieldErrors>({});
  const [verifiedResult, setVerifiedResult] = useState<VerifiedResult | null>(
    null
  );
  const [speicherGrenz, setSpeicherGrenz] =
    useState<SpeicherGrenzPayload | null>(null);
  const [robustness, setRobustness] = useState<WpuqRobustnessPayload | null>(
    null
  );
  const [wasserWasserRobustness, setWasserWasserRobustness] =
    useState<WwRobustnessPayload | null>(null);
  const [displayAddress, setDisplayAddress] = useState<string | null>(null);
  const [heatPumpCitation, setHeatPumpCitation] =
    useState<ReportHeatPumpCitation>(null);
  const [evResult, setEvResult] = useState<
    HouseholdCalculationPayload["ev"]
  >(null);
  const errorBoxRef = useRef<HTMLDivElement | null>(null);
  const calculatingStepRef = useRef<HTMLDivElement | null>(null);
  const resultsMastheadRef = useRef<HTMLDivElement | null>(null);
  const postalCodeInputRef = useRef<HTMLInputElement | null>(null);
  const cityInputRef = useRef<HTMLInputElement | null>(null);
  const streetInputRef = useRef<HTMLInputElement | null>(null);
  const houseNumberInputRef = useRef<HTMLInputElement | null>(null);
  const annualConsumptionInputRef = useRef<HTMLInputElement | null>(null);

  const fieldInputRefs: Record<
    (typeof FOCUS_FIELD_ORDER)[number],
    RefObject<HTMLInputElement | null>
  > = {
    postalCode: postalCodeInputRef,
    city: cityInputRef,
    street: streetInputRef,
    houseNumber: houseNumberInputRef,
    annualConsumptionKwh: annualConsumptionInputRef,
  };

  const clearFieldError = (field: SpeicherFieldErrorKey) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Form state
  const [formData, setFormData] = useState<Partial<SpeicherInput>>({
    pvSurfaces: [{ ...DEFAULT_SURFACE }],
    street: "",
    houseNumber: "",
    postalCode: "",
    city: "",
    annualConsumptionKwh: undefined,
    heatPumpEnabled: false,
    heatPumpConsumptionKwh: undefined,
    evEnabled: false,
    backupReserveKwh: 0,
  });

  /** Raw kWp strings per Dachfläche so comma decimals stay typable (controlled text input). */
  const [kwpInputStrings, setKwpInputStrings] = useState<string[]>([""]);

  /** Raw azimuth strings per Dachfläche so the field can be cleared while typing. */
  const [azimuthInputStrings, setAzimuthInputStrings] = useState<string[]>([
    String(DEFAULT_SURFACE.azimuthDeg),
  ]);

  /** Raw tilt strings per Dachfläche so the field can be cleared while typing. */
  const [tiltInputStrings, setTiltInputStrings] = useState<string[]>([
    String(DEFAULT_SURFACE.tiltDeg),
  ]);

  const surfaces = surfacesOrDefault(formData);

  const updateSurface = (
    planeIndex: number,
    patch: Partial<PvSurfaceInput>
  ) => {
    setFormData((prev) => {
      const list = [...surfacesOrDefault(prev)];
      list[planeIndex] = { ...list[planeIndex], ...patch };
      return {
        ...prev,
        pvSurfaces: list,
      };
    });
  };

  const addSurface = () => {
    setKwpInputStrings((prev) => [...prev, ""]);
    setAzimuthInputStrings((prev) => [
      ...prev,
      String(DEFAULT_SURFACE.azimuthDeg),
    ]);
    setTiltInputStrings((prev) => [
      ...prev,
      String(DEFAULT_SURFACE.tiltDeg),
    ]);
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
    setFormData((prev) => {
      const list = surfacesOrDefault(prev).filter((_, i) => i !== planeIndex);
      return { ...prev, pvSurfaces: list.length > 0 ? list : [{ ...DEFAULT_SURFACE }] };
    });
  };

  useEffect(() => {
    if (step !== "calculating" || calculationComplete) return;
    const startedAt = calculationStartedAtRef.current ?? Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, calculationComplete]);

  useEffect(() => {
    if (step !== "calculating" && step !== "results") return;

    const target =
      step === "calculating"
        ? calculatingStepRef.current
        : resultsMastheadRef.current;

    const scrollFrame = requestAnimationFrame(() => {
      target?.scrollIntoView({ behavior: "auto", block: "start" });
    });

    return () => cancelAnimationFrame(scrollFrame);
  }, [step]);

  useEffect(() => {
    if (errors.length === 0 || step !== "input") return;

    const scrollFrame = requestAnimationFrame(() => {
      errorBoxRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      requestAnimationFrame(() => {
        const firstInvalidField = FOCUS_FIELD_ORDER.find(
          (field) => fieldErrors[field]
        );
        if (firstInvalidField) {
          fieldInputRefs[firstInvalidField].current?.focus({
            preventScroll: true,
          });
        }
      });
    });

    return () => cancelAnimationFrame(scrollFrame);
  }, [errors, fieldErrors, step]);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    const validation = validateInput(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    setErrors([]);
    setFieldErrors({});
    setCalculationProgress(INITIAL_CALCULATION_PROGRESS);
    setElapsedSeconds(0);
    setCalculationComplete(false);
    setCalculationDurationMs(null);
    calculationStartedAtRef.current = Date.now();
    setHeatPumpCitation(null);
    setEvResult(null);
    setWasserWasserRobustness(null);
    setStep("calculating");

    try {
      const pvSurfaces = surfacesOrDefault(formData).map((s) => ({
        systemSizeKwP: s.systemSizeKwP,
        tiltDeg: s.tiltDeg,
        azimuthDeg: s.azimuthDeg,
      }));
      const totalKwP = sumSurfaceKwP(pvSurfaces);

      const response = await runHouseholdCalculationStream(
        {
          annualConsumptionKWh: formData.annualConsumptionKwh as number,
          pvSystemKwP: totalKwP,
          street: formData.street as string,
          houseNumber: formData.houseNumber as string,
          postalCode: formData.postalCode as string,
          city: formData.city as string,
          tiltDeg: pvSurfaces[0].tiltDeg,
          azimuthDeg: pvSurfaces[0].azimuthDeg,
          pvSurfaces,
          heatPumpEnabled: formData.heatPumpEnabled === true,
          heatPumpConsumptionKWh:
            formData.heatPumpEnabled === true
              ? formData.heatPumpConsumptionKwh
              : undefined,
          ...(formData.heatPumpEnabled === true
            ? {
                heatPumpTechnology: formData.heatPumpTechnology,
                heatPumpDhwService: formData.heatPumpDhwService,
              }
            : {}),
          ev: mapEvFormToCalculationInput(formData),
          backupReserveKwh: formData.backupReserveKwh,
        },
        (event) => {
          setCalculationProgress((prev) => applyCalculationProgress(prev, event));
        }
      );

      const startedAt = calculationStartedAtRef.current ?? Date.now();
      const durationMs = Date.now() - startedAt;
      setCalculationDurationMs(durationMs);
      setElapsedSeconds(Math.floor(durationMs / 1000));
      setCalculationComplete(true);

      setVerifiedResult(response.verifiedResult);
      setSpeicherGrenz(response.speicherGrenz);
      setRobustness(response.robustness);
      setWasserWasserRobustness(response.wasserWasserRobustness);
      setDisplayAddress(response.displayAddress);
      setHeatPumpCitation(
        response.heatPump
          ? { methodologySourceId: response.heatPump.methodologySourceId }
          : null
      );
      setEvResult(response.ev);
      await new Promise((resolve) =>
        setTimeout(resolve, CALCULATION_COMPLETE_PAUSE_MS)
      );
      setStep("results");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Die Berechnung ist fehlgeschlagen. Bitte versuchen Sie es erneut.";
      setErrors([message]);
      if (message === POSTAL_CODE_MISMATCH_GENERAL_MESSAGE) {
        setFieldErrors({ postalCode: "Bitte prüfen Sie die PLZ." });
      } else {
        setFieldErrors({});
      }
      setCalculationComplete(false);
      setCalculationDurationMs(null);
      calculationStartedAtRef.current = null;
      setStep("input");
    }
  };

  /**
   * Reset and start over
   */
  const handleReset = useCallback(() => {
    setStep("input");
    setVerifiedResult(null);
    setSpeicherGrenz(null);
    setRobustness(null);
    setDisplayAddress(null);
    setHeatPumpCitation(null);
    setEvResult(null);
    setCalculationComplete(false);
    setCalculationDurationMs(null);
    calculationStartedAtRef.current = null;
    setElapsedSeconds(0);
    setErrors([]);
    setFieldErrors({});
  }, []);

  useReportHeaderCta(handleReset, step === "results");

  const totalKwPConfigured = sumSurfaceKwP(surfaces);

  return (
    <div className="py-12">
      {/* ========== INPUT STEP ========== */}
      {step === "input" && (
        <div className="max-w-form mx-auto px-4 sm:px-6 lg:px-8">
          <div className={INPUT_SHEET}>
            {/* Header */}
            <div className="border-b border-line pb-6">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink mb-2">
                SpeicherGrenze – Ihre Analyse
              </h1>
              <p className="text-ink-secondary">
                Geben Sie Ihre Daten ein und erhalten Sie eine erste Einschätzung.
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-accent-text">
                Ersteinschätzung · Reale Referenzdaten · Unabhängige Analyse
              </p>
            </div>

            {/* Error display */}
            {errors.length > 0 && (
              <div
                ref={errorBoxRef}
                role="alert"
                aria-live="polite"
                className="mt-6 rounded-md border border-danger/40 bg-danger-soft p-4"
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

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className={`space-y-8 ${errors.length > 0 ? "mt-6" : "mt-8"}`}
              noValidate
            >
              {/* PV: one or multiple roof surfaces */}
              <div className="space-y-8">
                {surfaces.map((surface, planeIndex) => (
                  <div
                    key={planeIndex}
                    className={`space-y-4 ${
                      planeIndex > 0 ? "border-t border-line pt-8" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className={FORM_SECTION_HEADING}>
                        Dachfläche {planeIndex + 1}
                      </h2>
                      {planeIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => removeSurface(planeIndex)}
                          className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink"
                        >
                          Diese Fläche entfernen
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className={FORM_LABEL}>
                        PV-Leistung (kWp) *
                      </label>
                      <input
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
                        className={fieldInputClassName(false)}
                        placeholder="z.B. 10"
                      />
                      {planeIndex === 0 && (
                        <p className={FORM_HELP}>
                          Die Größe Ihrer bestehenden oder geplanten PV-Anlage
                          auf dieser Dachfläche.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className={FORM_LABEL}>
                            Dachausrichtung (°) *
                          </label>
                          <PresetDropdown
                            value={
                              Number.isFinite(surface.azimuthDeg)
                                ? surface.azimuthDeg
                                : ""
                            }
                            options={buildAzimuthDropdownOptions(
                              surface.azimuthDeg
                            )}
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
                        <div className="space-y-2">
                          <label className={FORM_LABEL}>
                            Exakter Azimut (°)
                          </label>
                          <input
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
                              const raw =
                                azimuthInputStrings[planeIndex] ?? "";
                              const parsed = parseAzimuthInput(raw);
                              if (!parsed.valid) return;
                              setAzimuthInputStrings((prev) => {
                                const next = [...prev];
                                next[planeIndex] = String(parsed.deg);
                                return next;
                              });
                              updateSurface(planeIndex, {
                                azimuthDeg: parsed.deg,
                              });
                            }}
                            className={fieldInputClassName(false)}
                          />
                          <p className={FORM_HELP}>
                            0° = Nord, 90° = Ost, 180° = Süd, 270° = West.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className={FORM_LABEL}>
                            Dachneigung (°) *
                          </label>
                          <PresetDropdown
                            value={
                              Number.isFinite(surface.tiltDeg)
                                ? surface.tiltDeg
                                : ""
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
                        <div className="space-y-2">
                          <label className={FORM_LABEL}>
                            Exakte Neigung (°)
                          </label>
                          <input
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
                              updateSurface(planeIndex, {
                                tiltDeg: parsed.deg,
                              });
                            }}
                            className={fieldInputClassName(false)}
                          />
                          <p className={FORM_HELP}>
                            0° = flach, 90° = senkrecht.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addSurface}
                  className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  Weitere Dachfläche hinzufügen
                </button>
              </div>

              {/* Address */}
              <div className="space-y-3 border-t border-line pt-8">
                <h2 className={FORM_SECTION_HEADING}>Standort / Adresse *</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className={FORM_LABEL}>
                      PLZ *
                    </label>
                    <input
                      ref={postalCodeInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={formData.postalCode ?? ""}
                      onChange={(e) => {
                        clearFieldError("postalCode");
                        setFormData({ ...formData, postalCode: e.target.value });
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
                  <div className="space-y-2">
                    <label className={FORM_LABEL}>
                      Ort *
                    </label>
                    <input
                      ref={cityInputRef}
                      type="text"
                      autoComplete="address-level2"
                      value={formData.city ?? ""}
                      onChange={(e) => {
                        clearFieldError("city");
                        setFormData({ ...formData, city: e.target.value });
                      }}
                      aria-invalid={fieldErrors.city ? true : undefined}
                      aria-describedby={
                        fieldErrors.city ? "city-error" : undefined
                      }
                      className={fieldInputClassName(!!fieldErrors.city)}
                      placeholder="z.B. München"
                    />
                    {fieldErrors.city && (
                      <p id="city-error" className="text-xs text-danger">
                        {fieldErrors.city}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className={FORM_LABEL}>
                      Straße *
                    </label>
                    <input
                      ref={streetInputRef}
                      type="text"
                      autoComplete="street-address"
                      value={formData.street ?? ""}
                      onChange={(e) => {
                        clearFieldError("street");
                        setFormData({ ...formData, street: e.target.value });
                      }}
                      aria-invalid={fieldErrors.street ? true : undefined}
                      aria-describedby={
                        fieldErrors.street ? "street-error" : undefined
                      }
                      className={fieldInputClassName(!!fieldErrors.street)}
                      placeholder="z.B. Marienplatz"
                    />
                    {fieldErrors.street && (
                      <p id="street-error" className="text-xs text-danger">
                        {fieldErrors.street}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className={FORM_LABEL}>
                      Hausnummer *
                    </label>
                    <input
                      ref={houseNumberInputRef}
                      type="text"
                      autoComplete="off"
                      value={formData.houseNumber ?? ""}
                      onChange={(e) => {
                        clearFieldError("houseNumber");
                        setFormData({
                          ...formData,
                          houseNumber: e.target.value,
                        });
                      }}
                      aria-invalid={fieldErrors.houseNumber ? true : undefined}
                      aria-describedby={
                        fieldErrors.houseNumber ? "houseNumber-error" : undefined
                      }
                      className={fieldInputClassName(!!fieldErrors.houseNumber)}
                      placeholder="z.B. 1"
                    />
                    {fieldErrors.houseNumber && (
                      <p id="houseNumber-error" className="text-xs text-danger">
                        {fieldErrors.houseNumber}
                      </p>
                    )}
                  </div>
                </div>
                <p className={FORM_HELP}>
                  Bitte geben Sie die vollständige Adresse des Gebäudes ein.
                </p>
              </div>

              {/* Annual Consumption */}
              <div className="space-y-2 border-t border-line pt-8">
                <label className={FORM_LABEL}>
                  Hausverbrauch (ohne Wärmepumpe) *
                </label>
                <input
                  ref={annualConsumptionInputRef}
                  type="number"
                  min="500"
                  max="50000"
                  value={formData.annualConsumptionKwh || ""}
                  onChange={(e) => {
                    clearFieldError("annualConsumptionKwh");
                    setFormData({
                      ...formData,
                      annualConsumptionKwh:
                        parseInt(e.target.value) || undefined,
                    });
                  }}
                  aria-invalid={
                    fieldErrors.annualConsumptionKwh ? true : undefined
                  }
                  aria-describedby={
                    fieldErrors.annualConsumptionKwh
                      ? "annualConsumptionKwh-error"
                      : undefined
                  }
                  className={fieldInputClassName(!!fieldErrors.annualConsumptionKwh)}
                  placeholder="z.B. 4500"
                />
                {fieldErrors.annualConsumptionKwh && (
                  <p
                    id="annualConsumptionKwh-error"
                    className="text-xs text-danger"
                  >
                    {fieldErrors.annualConsumptionKwh}
                  </p>
                )}
                <p className={FORM_HELP}>
                  Bitte geben Sie hier nur den Haushaltsstromverbrauch ein – ohne
                  Wärmepumpe.
                </p>
              </div>

              {/* Heat pump */}
              <div className="border-t border-line pt-8">
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
                          setFormData({
                            ...formData,
                            heatPumpEnabled: false,
                            heatPumpConsumptionKwh: undefined,
                            heatPumpTechnology: undefined,
                            heatPumpDhwService: undefined,
                          })
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
                          setFormData({
                            ...formData,
                            heatPumpEnabled: true,
                          })
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
                      <legend className={FORM_LABEL}>
                        Typ der Wärmepumpe
                      </legend>
                      <div className="mt-3 flex flex-col gap-3">
                        <label className={FORM_RADIO_OPTION}>
                          <input
                            type="radio"
                            name="heatPumpTechnology"
                            checked={
                              formData.heatPumpTechnology === "luftwasser"
                            }
                            onChange={() => {
                              clearFieldError("heatPumpTechnology");
                              setFormData({
                                ...formData,
                                heatPumpTechnology: "luftwasser",
                              });
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
                            checked={
                              formData.heatPumpTechnology === "wasserwasser"
                            }
                            onChange={() => {
                              clearFieldError("heatPumpTechnology");
                              clearFieldError("heatPumpDhwService");
                              setFormData({
                                ...formData,
                                heatPumpTechnology: "wasserwasser",
                                heatPumpDhwService:
                                  formData.heatPumpDhwService ===
                                  "space_heat_only"
                                    ? undefined
                                    : formData.heatPumpDhwService,
                              });
                            }}
                            className="mt-0.5 h-4 w-4 shrink-0 border-field-border accent-accent"
                          />
                          <span>
                            Wasser/Wasser
                            <span className={FORM_RADIO_HINT}>
                              Nutzt Grundwasser bzw. ein kaltes Nahwärmenetz
                              als Wärmequelle.
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
                                  formData.heatPumpDhwService ===
                                  "space_heat_only"
                                }
                                onChange={() => {
                                  clearFieldError("heatPumpDhwService");
                                  setFormData({
                                    ...formData,
                                    heatPumpDhwService: "space_heat_only",
                                  });
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
                                formData.heatPumpDhwService ===
                                "space_heat_and_dhw"
                              }
                              onChange={() => {
                                clearFieldError("heatPumpDhwService");
                                setFormData({
                                  ...formData,
                                  heatPumpDhwService: "space_heat_and_dhw",
                                });
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
                          setFormData({
                            ...formData,
                            heatPumpConsumptionKwh:
                              parseInt(e.target.value, 10) || undefined,
                          });
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
                        Falls vorhanden: separater Stromverbrauch Ihrer
                        Wärmepumpe.
                      </p>
                    </div>
                  </div>
                )}
                <p className={FORM_HELP}>
                  Viele Haushalte haben mit Wärmepumpe einen deutlich höheren
                  Stromverbrauch im Winter. Diese wird hier separat
                  berücksichtigt.
                </p>
                </div>
              </div>

              <EvInputSection
                formData={formData}
                fieldErrors={fieldErrors}
                onChange={(patch) =>
                  setFormData((prev) => ({ ...prev, ...patch }))
                }
                clearFieldError={clearFieldError}
              />

              {/* Notstromreserve */}
              <div className="border-t border-line pt-8">
                <div className={FORM_OPTIONAL_BLOCK}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="backupReserveEnabled"
                    checked={(formData.backupReserveKwh ?? 0) > 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        backupReserveKwh: e.target.checked ? 2 : 0,
                      })
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-field-border accent-accent"
                  />
                  <span className="text-sm font-medium text-ink">
                    Notstromreserve aktivieren
                  </span>
                </label>
                {(formData.backupReserveKwh ?? 0) > 0 && (
                  <div className="space-y-2 pl-7 mt-3">
                    <span className={`block ${FORM_LABEL}`}>
                      Reservierte Kapazität
                    </span>
                    <div className="flex flex-col gap-2">
                      {BACKUP_RESERVE_RADIO_OPTIONS.map((opt) => (
                        <label
                          key={opt.kwh}
                          className="flex items-center gap-2 cursor-pointer text-sm text-ink"
                        >
                          <input
                            type="radio"
                            name="backupReserveKwhOption"
                            checked={formData.backupReserveKwh === opt.kwh}
                            onChange={() =>
                              setFormData({
                                ...formData,
                                backupReserveKwh: opt.kwh,
                              })
                            }
                            className="h-4 w-4 shrink-0 border-field-border accent-accent"
                          />
                          <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                            <span>{opt.label}</span>
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
                  Ein Teil des Speichers wird für Notfälle reserviert und im
                  Alltag nicht genutzt.
                  <br />
                  Dies reduziert leicht Eigenverbrauch und Autarkie.
                </p>
                </div>
              </div>

              {/* Submit */}
              <div className={`${FORM_SUBMIT_ZONE} -mb-5 pb-5 sm:-mb-8 sm:pb-8`}>
                <button type="submit" className={`${BTN_PRIMARY} w-full`}>
                  Berechnung starten
                </button>
              </div>
            </form>

            <div className="mt-8 border-t border-line pt-6">
              <p className="text-sm leading-relaxed text-ink-secondary max-w-reading">
                Unsere Berechnung basiert auf offiziellen Wetterdaten,
                BDEW-Lastprofilen und einer dokumentierten Simulationsmethodik.
              </p>
              <p className="mt-2">
                <Link
                  href="/methodik"
                  className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  → Methodik
                </Link>
              </p>
            </div>

            {/* Disclaimer */}
            <p className="mt-6 border-t border-line-soft pt-6 text-xs text-ink-muted">
              * Pflichtfelder. Ihre Daten werden nicht gespeichert.
            </p>
          </div>
        </div>
      )}

      {/* ========== CALCULATING STEP ========== */}
      {step === "calculating" && (
        <div
          ref={calculatingStepRef}
          className="mx-auto flex w-full max-w-frame scroll-mt-20 justify-center px-4 py-10 sm:px-6 lg:px-8"
        >
          <CalculationProgressList
            progress={calculationProgress}
            elapsedSeconds={elapsedSeconds}
            complete={calculationComplete}
            includeHeatPumpProfile={
              formData.heatPumpEnabled === true &&
              (formData.heatPumpTechnology === "luftwasser" ||
                formData.heatPumpTechnology === "wasserwasser")
                ? formData.heatPumpTechnology
                : false
            }
            includeEvProfile={
              mapEvFormToCalculationInput(formData).enabled === true
            }
          />
        </div>
      )}

      {/* ========== RESULTS STEP ========== */}
      {step === "results" && (
        <SpeicherReportView
          mode="live"
          verifiedResult={verifiedResult}
          speicherGrenz={speicherGrenz}
          robustness={robustness}
          wasserWasserRobustness={wasserWasserRobustness}
          ev={evResult}
          heatPumpCitation={heatPumpCitation}
          displayAddress={displayAddress}
          surfaces={surfaces}
          input={{
            annualConsumptionKwh: formData.annualConsumptionKwh,
            heatPumpEnabled: formData.heatPumpEnabled,
            heatPumpConsumptionKwh: formData.heatPumpConsumptionKwh,
            heatPumpTechnology: formData.heatPumpTechnology,
            heatPumpDhwService: formData.heatPumpDhwService,
            evEnabled: formData.evEnabled,
            backupReserveKwh: formData.backupReserveKwh,
          }}
          totalKwPConfigured={totalKwPConfigured}
          calculationDurationMs={calculationDurationMs}
          mastheadRef={resultsMastheadRef}
        />
      )}
    </div>
  );
}
