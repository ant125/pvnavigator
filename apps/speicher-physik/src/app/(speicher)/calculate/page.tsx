"use client";

import { useState, useEffect, useRef, useCallback, type RefObject } from "react";
import Link from "next/link";
import { SpeicherInput, type PvSurfaceInput } from "../types/speicher";
import { validateInput, type SpeicherFieldErrors, type SpeicherFieldErrorKey } from "../utils/validateInput";
import {
  type SpeicherGrenzPayload,
  type VerifiedResult,
  type WpuqRobustnessPayload,
} from "./actions";
import { deriveSpeicherBusinessMetrics } from "@/lib/deriveSpeicherBusinessMetrics";
import SpeicherChart from "@/components/SpeicherChart";
import {
  ReportQuellenSection,
  WpuqRobustnessSection,
} from "./WpuqRobustnessSection";
import { CalculationProgressList } from "./CalculationProgressList";
import {
  CALCULATION_COMPLETE_PAUSE_MS,
  INITIAL_CALCULATION_PROGRESS,
  SMART_METER_HOUSEHOLD_COUNT,
  applyCalculationProgress,
  formatCalculationDurationDe,
} from "@/lib/calculationProgress";
import {
  getReportDurationInclusions,
  type ReportHeatPumpCitation,
} from "@/lib/reportMethodologySources";
import { runHouseholdCalculationStream } from "./runHouseholdCalculationStream";
import { useReportHeaderCta } from "../components/headerCtaContext";

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

/**
 * The result is one document: a single white sheet on the light canvas. Every
 * result section lives inside this sheet, so the page has exactly one vertical
 * document edge instead of a stack of separately framed cards.
 */
const REPORT_SHEET =
  "max-w-sheet mx-auto rounded-lg border border-line bg-surface p-5 sm:p-8 lg:p-10";

/**
 * Major section boundary inside the sheet: one rule with symmetric space above
 * and below, so every section transition carries the same weight. Section
 * headings therefore need no rule of their own.
 */
const REPORT_SECTION = "mt-8 border-t border-line pt-8 lg:mt-10 lg:pt-10";

/** Report-section heading — a document chapter, not a micro label. */
const REPORT_SECTION_HEADING = "text-lg font-semibold text-ink";

/** Micro label above a value or a form group. */
const REPORT_SECTION_TITLE =
  "text-xs font-semibold uppercase tracking-wide text-ink-secondary";

/** Label of a group nested inside a section — one step darker than a micro label. */
const REPORT_GROUP_TITLE =
  "text-xs font-semibold uppercase tracking-wide text-ink";

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

const FORM_UNAVAILABLE_BADGE =
  "inline-flex items-center rounded border border-line px-1.5 py-px text-[10px] font-medium text-ink-muted";

const HEAT_PUMP_DHW_LABELS = {
  space_heat_and_dhw: "Heizung und Warmwasser",
  space_heat_only: "Nur Heizung",
} as const;

/**
 * Main + aside split of a section: the primary result on the left, the
 * reference value and its caveats on the right, divided by a hairline.
 */
const REPORT_SPLIT = "grid gap-8 lg:grid-cols-[3fr_2fr] lg:gap-12";

const REPORT_SPLIT_ASIDE =
  "border-t border-line-soft pt-6 lg:border-t-0 lg:border-l lg:border-line-soft lg:pt-0 lg:pl-8";

/**
 * Two side-by-side metric/comparison tracks. Each track is an independent
 * closed table, so the report width carries two columns of metrics instead of
 * one long single-column list.
 */
const REPORT_TWO_TRACKS = "grid gap-x-12 gap-y-8 lg:grid-cols-2";

/** One metric/comparison track: a closed table of label/value rows. */
const REPORT_METRIC_LIST =
  "divide-y divide-line-soft border-y border-line-soft text-sm";

/** Metric row: label left, value aligned to the right edge of its track. */
const REPORT_METRIC_ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 py-3";

const REPORT_METRIC_LABEL = "min-w-0 leading-snug text-ink-secondary";

const REPORT_METRIC_VALUE =
  "shrink-0 text-right tabular-nums font-medium text-ink";

const REPORT_METRIC_VALUE_ACCENT =
  "shrink-0 text-right tabular-nums font-semibold text-accent-text";

/**
 * Stammdaten datasheet: short label above its value, three columns on desktop,
 * so a small dataset stays horizontally compact instead of vertically long.
 */
const REPORT_DATA_GRID = "grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3";

const REPORT_DATA_ITEM = "border-t border-line-soft pt-3";

const REPORT_DATA_LABEL = "text-xs leading-snug text-ink-muted";

const REPORT_DATA_VALUE = "mt-1 text-sm font-medium tabular-nums text-ink";

/**
 * Tinted technical band for a nested energy balance inside a section: the total
 * on top, its components below, all within one boundary so the components read
 * as parts of that total rather than as separate metrics.
 */
const REPORT_BAND =
  "mt-8 rounded-md border border-line-soft bg-surface-muted p-5 lg:p-6";

const REPORT_BAND_GRID =
  "mt-5 grid gap-x-8 gap-y-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3";

/**
 * Written conclusion of the report: prose on the left, key figures in the
 * split aside. Hierarchy comes from colour and spacing within the prose track.
 */
const REPORT_CONCLUSION_BODY = "text-sm leading-relaxed text-ink";

const REPORT_CONCLUSION_CONTEXT = "text-sm leading-relaxed text-ink-secondary";

/** Methodological note closing the conclusion — demoted footnote prose. */
const REPORT_NOTE = "text-xs leading-relaxed text-ink-muted";

const SPEICHER_REPORT_HELPER_TEXT =
  "text-xs leading-snug text-ink-muted font-normal normal-case";

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

/** Ausgangsdaten: up to 2 fractional digits, strip trailing zeros (12.54 → "12.54", 12.5 → "12.5", 12 → "12"). */
function formatKwpDisplay(n: number): string {
  if (!Number.isFinite(n)) return "";
  return parseFloat((Math.round(n * 100) / 100).toFixed(2)).toString();
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
  const [calculationLink, setCalculationLink] = useState<string>("/result");
  const [displayAddress, setDisplayAddress] = useState<string | null>(null);
  const [heatPumpCitation, setHeatPumpCitation] =
    useState<ReportHeatPumpCitation>(null);
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

  const PLACEHOLDER = "—";
  const formatKwh = (value: number | null | undefined) =>
    typeof value === "number" ? `${value.toFixed(0)} kWh` : PLACEHOLDER;

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
      setDisplayAddress(response.displayAddress);
      setHeatPumpCitation(
        response.heatPump
          ? { methodologySourceId: response.heatPump.methodologySourceId }
          : null
      );
      setCalculationLink("/result");

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
    setCalculationLink("/result");
    setCalculationComplete(false);
    setCalculationDurationMs(null);
    calculationStartedAtRef.current = null;
    setElapsedSeconds(0);
    setErrors([]);
    setFieldErrors({});
  }, []);

  useReportHeaderCta(handleReset, step === "results");

  const totalKwPConfigured = sumSurfaceKwP(surfaces);

  const metrics = deriveSpeicherBusinessMetrics({
    verifiedResult,
    speicherGrenz,
    annualConsumptionKwh: formData.annualConsumptionKwh,
    heatPumpEnabled: formData.heatPumpEnabled,
    heatPumpConsumptionKwh: formData.heatPumpConsumptionKwh,
    backupReserveKwh: formData.backupReserveKwh,
    totalKwPConfigured,
  });

  const {
    chart,
    recommendedTechnicalSize,
    recommendedPlanningSize,
    physicalKpiLookupSize,
    planningExceedsSimulatedRange,
    recommendedEV,
    batteryGeladenAvgKwh,
    batteryAnVerbrauchAvgKwh,
    batterieverlusteModellGesamtKwh,
    avgSelfDischargeLossDisplayKwh,
    avgAuxiliaryConsumptionDisplayKwh,
    eigenverbrauchMitSpeicher,
    autarkieOhnePct,
    autarkieMitPct,
    deltaAutarkiePctPoints,
    deltaEigenverbrauch,
    resolvedBackupReserveKwh,
    pvYieldKwhAnnual,
    specificYieldKwhPerKwp,
    netzbezugMitSpeicherKwhYear,
    einspeisungRechnerischKwhYear,
    eigenverbrauchsquoteMitSpeicherPct,
  } = metrics;

  const hybridChargeBreakdownAvgKwh =
    speicherGrenz && physicalKpiLookupSize > 0
      ? (speicherGrenz.averageChargeLossPvToBatteryKwh[physicalKpiLookupSize] ??
          0) +
        (speicherGrenz.averageChargeLossChemicalKwh[physicalKpiLookupSize] ?? 0)
      : 0;
  const showBatterieverlusteHybridBreakdown =
    speicherGrenz != null &&
    physicalKpiLookupSize > 0 &&
    batterieverlusteModellGesamtKwh !== null &&
    hybridChargeBreakdownAvgKwh > 1e-3;

  const hasActiveBackupReserve =
    typeof resolvedBackupReserveKwh === "number" &&
    Number.isFinite(resolvedBackupReserveKwh) &&
    resolvedBackupReserveKwh > 0;

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
                        <label className="flex items-start gap-2 text-sm text-ink-muted">
                          <input
                            type="radio"
                            disabled
                            checked={false}
                            tabIndex={-1}
                            aria-disabled="true"
                            className="mt-0.5 h-4 w-4 shrink-0 cursor-not-allowed border-field-border accent-accent"
                          />
                          <span>
                            <span className="inline-flex flex-wrap items-center gap-2">
                              Wasser/Wasser
                              <span className={FORM_UNAVAILABLE_BADGE}>
                                Demnächst verfügbar
                              </span>
                            </span>
                            <span className={FORM_RADIO_HINT}>
                              Nutzt Grundwasser als Wärmequelle.
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

                    {formData.heatPumpTechnology === "luftwasser" && (
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
                  href="/methodik-quellen"
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
              formData.heatPumpTechnology === "luftwasser"
            }
          />
        </div>
      )}

      {/* ========== RESULTS STEP ========== */}
      {step === "results" && (
        <div className="max-w-frame mx-auto px-4 sm:px-6 lg:px-8">
          <div className={REPORT_SHEET}>
            {/* Masthead — title block of the report sheet */}
            <div ref={resultsMastheadRef} className="scroll-mt-20">
              <div className="flex items-center gap-1.5">
                <svg
                  className="h-4 w-4 shrink-0 text-accent-text"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">
                  Analyse abgeschlossen
                </span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
                Ihre Speicher-Analyse
              </h1>
            </div>

            {/* Recommended Size */}
            <section className={REPORT_SECTION}>
              <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
                Berechnung nach BDEW H25
              </h2>
              {recommendedTechnicalSize > 0 ? (
                /*
                  One composition instead of a headline grid stacked on a second
                  grid: the purchase-planning result and its derivation form the
                  main column, the physical reference value and its caveats the
                  aside. The planning value therefore outranks the technical one
                  typographically while both stay visibly related.
                */
                <div className={REPORT_SPLIT}>
                  <div className="space-y-6">
                    <div>
                      <p className={REPORT_SECTION_TITLE}>
                        Planerische Kaufempfehlung
                      </p>
                      <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-ink">
                        {recommendedPlanningSize} kWh
                      </p>
                    </div>

                    <div className="space-y-4 text-sm leading-relaxed text-ink-secondary">
                      <p>
                        Die physikalische Simulation ermittelt für die heutigen
                        Bedingungen eine technische Speichergrenze von{" "}
                        <strong className="font-semibold text-ink">
                          {recommendedTechnicalSize} kWh nutzbarer Kapazität
                        </strong>
                        .
                      </p>
                      <p>
                        Für die Kaufplanung wird zusätzlich eine pauschale
                        Alterungsreserve berücksichtigt. Dabei wird angenommen,
                        dass nach einem Planungszeitraum von etwa 10 Jahren
                        noch 75&nbsp;% der anfänglichen nutzbaren Kapazität
                        verfügbar sind.
                      </p>
                      <p className="rounded-md border border-line-soft bg-surface-muted px-4 py-3 font-medium tabular-nums text-ink">
                        Planerische Anfangskapazität = ⌈{" "}
                        {recommendedTechnicalSize} kWh / 0,75 ⌉ ={" "}
                        {recommendedPlanningSize} kWh
                      </p>
                    </div>
                  </div>

                  <div className={`${REPORT_SPLIT_ASIDE} space-y-4`}>
                    <div>
                      <p className={REPORT_SECTION_TITLE}>
                        Technische Speichergrenze heute:
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                        {recommendedTechnicalSize} kWh
                      </p>
                    </div>
                    <p className="text-xs italic leading-relaxed text-ink-muted">
                      Die 75-%-Annahme ist keine Prognose für einen bestimmten
                      Batteriespeicher und keine Herstellergarantie. Sie
                      beeinflusst ausschließlich die planerische
                      Kaufempfehlung. Die technische Simulation und sämtliche
                      technischen Kennzahlen werden weiterhin mit der
                      technischen Speichergrenze von{" "}
                      {recommendedTechnicalSize} kWh berechnet.
                    </p>
                    {planningExceedsSimulatedRange && (
                      <p className="rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning">
                        Die planerische Anfangskapazität liegt außerhalb des
                        simulierten Speicherbereichs von 5–30 kWh.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-reading">
                  <p className={REPORT_SECTION_TITLE}>Speicherempfehlung</p>
                  <p className="mt-2 text-lg font-semibold leading-relaxed text-ink">
                    Unter den aktuellen Annahmen ist kein Batteriespeicher
                    technisch erforderlich.
                  </p>
                </div>
              )}
            </section>

            {/*
              Two comparison groups instead of a four-tile strip: each group
              reads "ohne Speicher" (left) → "mit Speicher" (right, accented,
              with its delta), separated by a hairline.
            */}
            <section className={`${REPORT_SECTION} ${REPORT_TWO_TRACKS}`}>
              <div>
                <h3 className={`mb-3 ${REPORT_GROUP_TITLE}`}>
                  Eigenverbrauch
                </h3>
                <div className={REPORT_METRIC_LIST}>
                  <div className={REPORT_METRIC_ROW}>
                    <span className={REPORT_METRIC_LABEL}>
                      Eigenverbrauch ohne Speicher (jährlich)
                    </span>
                    <span className="shrink-0 text-right text-base font-medium tabular-nums text-ink">
                      {formatKwh(
                        verifiedResult?.energy.year
                          .selfConsumptionWithoutStorage
                      )}
                    </span>
                  </div>
                  <div className={REPORT_METRIC_ROW}>
                    <span className={REPORT_METRIC_LABEL}>
                      Eigenverbrauch mit Speicher
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-semibold tabular-nums text-accent-text">
                        {formatKwh(recommendedEV)}
                      </span>
                      {deltaEigenverbrauch !== null && (
                        <span className="mt-0.5 block text-xs font-medium tabular-nums text-success">
                          ({deltaEigenverbrauch >= 0 ? "+" : ""}
                          {deltaEigenverbrauch} kWh)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`mb-3 ${REPORT_GROUP_TITLE}`}>Autarkie</h3>
                <div className={REPORT_METRIC_LIST}>
                  <div className={REPORT_METRIC_ROW}>
                    <span className={REPORT_METRIC_LABEL}>
                      Autarkie ohne Speicher:
                    </span>
                    <span className="shrink-0 text-right text-base font-medium tabular-nums text-ink">
                      {autarkieOhnePct !== null
                        ? `${autarkieOhnePct} %`
                        : PLACEHOLDER}
                    </span>
                  </div>
                  <div className={REPORT_METRIC_ROW}>
                    <span className={REPORT_METRIC_LABEL}>
                      Autarkie mit Speicher:
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-semibold tabular-nums text-accent-text">
                        {autarkieMitPct !== null
                          ? `${autarkieMitPct} %`
                          : PLACEHOLDER}
                      </span>
                      {deltaAutarkiePctPoints !== null && (
                        <span className="mt-0.5 block text-xs font-medium tabular-nums text-success">
                          ({deltaAutarkiePctPoints >= 0 ? "+" : ""}
                          {deltaAutarkiePctPoints} Prozentpunkte)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {speicherGrenz && (
              <>
                <section className={REPORT_SECTION}>
                    <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
                      Ihre Eingabedaten
                    </h2>

                    {/*
                      Stammdaten as a datasheet grid: label above value, so a
                      short dataset reads across the report width instead of
                      running down a long two-column table.
                    */}
                    <dl className={REPORT_DATA_GRID}>
                      <div className={`${REPORT_DATA_ITEM} sm:col-span-2`}>
                        <dt className={REPORT_DATA_LABEL}>Adresse:</dt>
                        <dd
                          className={`${REPORT_DATA_VALUE} break-words whitespace-normal`}
                        >
                          {displayAddress ?? PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>PV-Anlage:</dt>
                        <dd className={REPORT_DATA_VALUE}>
                          <span>
                            {Number.isFinite(totalKwPConfigured)
                              ? formatKwpDisplay(totalKwPConfigured)
                              : PLACEHOLDER}{" "}
                            kWp
                          </span>
                          {surfaces.length > 1 && (
                            <span className="text-ink-secondary font-normal">{` auf ${surfaces.length} Dachflächen`}</span>
                          )}
                          {surfaces.length > 1 && (
                            <div className={`mt-2 ${SPEICHER_REPORT_HELPER_TEXT} space-y-1`}>
                              {surfaces.map((s, i) => (
                                <div key={i}>
                                  Dachfläche {i + 1}: {Number.isFinite(s.systemSizeKwP) ? formatKwpDisplay(s.systemSizeKwP) : PLACEHOLDER} kWp,
                                  {" "}{s.tiltDeg}°, {s.azimuthDeg}°
                                </div>
                              ))}
                            </div>
                          )}
                        </dd>
                      </div>

                      {surfaces.length === 1 && (
                        <>
                          <div className={REPORT_DATA_ITEM}>
                            <dt className={REPORT_DATA_LABEL}>Neigung:</dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {surfaces[0]?.tiltDeg}°
                            </dd>
                          </div>

                          <div className={REPORT_DATA_ITEM}>
                            <dt className={REPORT_DATA_LABEL}>
                              Ausrichtung:
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {surfaces[0]?.azimuthDeg}°
                            </dd>
                          </div>
                        </>
                      )}

                      {hasActiveBackupReserve && (
                        <div className={REPORT_DATA_ITEM}>
                          <dt className={REPORT_DATA_LABEL}>
                            Notstromreserve:
                          </dt>
                          <dd className={REPORT_DATA_VALUE}>
                            {resolvedBackupReserveKwh} kWh
                          </dd>
                        </div>
                      )}

                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>
                          Hausverbrauch (ohne Wärmepumpe):
                        </dt>
                        <dd className={REPORT_DATA_VALUE}>
                          {formData.annualConsumptionKwh} kWh/Jahr
                        </dd>
                      </div>

                      {formData.heatPumpEnabled === true && (
                        <>
                          <div className={REPORT_DATA_ITEM}>
                            <dt className={REPORT_DATA_LABEL}>Wärmepumpe:</dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {formData.heatPumpConsumptionKwh} kWh/Jahr
                            </dd>
                          </div>
                          {formData.heatPumpTechnology === "luftwasser" && (
                            <div className={REPORT_DATA_ITEM}>
                              <dt className={REPORT_DATA_LABEL}>
                                Typ der Wärmepumpe:
                              </dt>
                              <dd className={REPORT_DATA_VALUE}>Luft/Wasser</dd>
                            </div>
                          )}
                          {formData.heatPumpDhwService && (
                            <div className={REPORT_DATA_ITEM}>
                              <dt className={REPORT_DATA_LABEL}>
                                Verwendung:
                              </dt>
                              <dd className={REPORT_DATA_VALUE}>
                                {
                                  HEAT_PUMP_DHW_LABELS[
                                    formData.heatPumpDhwService
                                  ]
                                }
                              </dd>
                            </div>
                          )}
                        </>
                      )}

                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>
                          Gesamtverbrauch:
                        </dt>
                        <dd className={REPORT_DATA_VALUE}>
                          <div>
                            {(formData.annualConsumptionKwh ?? 0) +
                              (formData.heatPumpEnabled === true
                                ? formData.heatPumpConsumptionKwh ?? 0
                                : 0)}{" "}
                            kWh/Jahr
                          </div>
                          {formData.heatPumpEnabled === true && (
                            <div className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-1`}>
                              davon Wärmepumpe: {formData.heatPumpConsumptionKwh}{" "}
                              kWh
                            </div>
                          )}
                        </dd>
                      </div>
                    </dl>
                </section>

                <section className={REPORT_SECTION}>
                    <div className="mb-6">
                      <h2 className={REPORT_SECTION_HEADING}>
                        Technische Kennzahlen
                      </h2>
                      <p className="mt-2 max-w-reading text-xs leading-relaxed text-ink-muted">
                        Alle technischen Kennzahlen beziehen sich auf die
                        technische Speichergrenze von{" "}
                        <strong className="font-semibold text-ink-secondary">
                          {recommendedTechnicalSize} kWh
                        </strong>{" "}
                        und nicht auf die planerische Kaufempfehlung.
                      </p>
                    </div>

                    {/*
                      Two metric tracks: energy flow on the left, system, grid
                      and autarky on the right. The nested battery-loss balance
                      follows below as its own full-width band.
                    */}
                    <div className={REPORT_TWO_TRACKS}>
                    <dl className={REPORT_METRIC_LIST}>
                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Jahresertrag PV
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof pvYieldKwhAnnual === "number" &&
                          Number.isFinite(pvYieldKwhAnnual)
                            ? `${pvYieldKwhAnnual.toFixed(0)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Spezifischer Ertrag
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {specificYieldKwhPerKwp !== null
                            ? `${specificYieldKwhPerKwp.toFixed(1)} kWh/kWp`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Direktverbrauch ohne Speicher
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {formatKwh(
                            verifiedResult?.energy.year.selfConsumptionWithoutStorage
                          )}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Eigenverbrauch mit Speicher
                        </dt>
                        <dd className={REPORT_METRIC_VALUE_ACCENT}>
                          {formatKwh(eigenverbrauchMitSpeicher)}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          <span className="block leading-snug">
                            PV-Energie zur Batterieladung
                          </span>
                          <span
                            className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}
                          >
                            PV-Überschuss vor den modellierten Ladeverlusten.
                          </span>
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof batteryGeladenAvgKwh === "number" &&
                          Number.isFinite(batteryGeladenAvgKwh)
                            ? `${Math.round(batteryGeladenAvgKwh)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          <span className="block leading-snug">
                            Batterie → Haushalt (AC)
                          </span>
                          <span
                            className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}
                          >
                            An den Haushalt gelieferte Energie nach den
                            modellierten Entladeverlusten.
                          </span>
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof batteryAnVerbrauchAvgKwh === "number" &&
                          Number.isFinite(batteryAnVerbrauchAvgKwh)
                            ? `${Math.round(batteryAnVerbrauchAvgKwh)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>
                    </dl>

                    <dl className={REPORT_METRIC_LIST}>
                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          <span className="block leading-snug">
                            Systemverbrauch Standby
                          </span>
                          <span
                            className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}
                          >
                            Gesamter Eigenbedarf des Speichersystems; kann durch
                            PV, Batterie oder Netz gedeckt werden. Separat
                            bilanziert; nicht im Haushaltsverbrauch,
                            Eigenverbrauch oder Autarkiegrad enthalten.
                          </span>
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof avgAuxiliaryConsumptionDisplayKwh ===
                            "number" &&
                          Number.isFinite(avgAuxiliaryConsumptionDisplayKwh)
                            ? `${Math.round(avgAuxiliaryConsumptionDisplayKwh)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          <span className="block leading-snug">
                            Netzbezug Haushalt mit Speicher
                          </span>
                          <span
                            className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}
                          >
                            Nur Netzbezug des Haushalts einschließlich
                            Wärmepumpe; Netzbezug des Speichersystems ist nicht
                            enthalten.
                          </span>
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof netzbezugMitSpeicherKwhYear === "number" &&
                          Number.isFinite(netzbezugMitSpeicherKwhYear)
                            ? `${netzbezugMitSpeicherKwhYear.toFixed(0)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          <span className="block leading-snug">
                            Modellierte Netzeinspeisung
                          </span>
                          <span className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}>
                            Verbleibender PV-Überschuss am AC-Bus nach
                            Haushaltsverbrauch, Systemverbrauch und
                            Batterieladung. Keine Abbildung von EEG-Abrechnung
                            oder realem Zählerverhalten.
                          </span>
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {typeof einspeisungRechnerischKwhYear === "number" &&
                          Number.isFinite(einspeisungRechnerischKwhYear)
                            ? `${einspeisungRechnerischKwhYear.toFixed(0)} kWh/Jahr`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Autarkiegrad mit Speicher
                        </dt>
                        <dd className={REPORT_METRIC_VALUE_ACCENT}>
                          {autarkieMitPct !== null
                            ? `${autarkieMitPct} %`
                            : PLACEHOLDER}
                        </dd>
                      </div>

                      <div className={REPORT_METRIC_ROW}>
                        <dt className={REPORT_METRIC_LABEL}>
                          Eigenverbrauchsquote
                        </dt>
                        <dd className={REPORT_METRIC_VALUE}>
                          {eigenverbrauchsquoteMitSpeicherPct !== null
                            ? `${eigenverbrauchsquoteMitSpeicherPct} %`
                            : PLACEHOLDER}
                        </dd>
                      </div>
                    </dl>
                    </div>

                    {/*
                      Battery losses are a nested energy balance, not a single
                      metric: the total sits on top of the band and its
                      components fill a mini-grid inside the same boundary, so
                      they read as parts of that total.
                    */}
                    {speicherGrenz && showBatterieverlusteHybridBreakdown ? (
                      <div className={REPORT_BAND}>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6">
                          <div>
                            <span className="block text-sm font-semibold leading-snug text-ink">
                              Batterieverluste gesamt
                            </span>
                            <span
                              className={`mt-1 block max-w-reading ${SPEICHER_REPORT_HELPER_TEXT}`}
                            >
                              Summe aus Lade-, Entladeverlusten und
                              Selbstentladung (Mehrjahresmittel). Einzelne
                              gerundete Komponenten können vom gerundeten
                              Gesamtwert um 1&nbsp;kWh abweichen.
                            </span>
                          </div>
                          <div className="shrink-0 text-right text-lg font-semibold tabular-nums text-ink">
                            {batterieverlusteModellGesamtKwh !== null
                              ? `${batterieverlusteModellGesamtKwh} kWh/Jahr`
                              : PLACEHOLDER}
                          </div>
                        </div>

                        <dl className={REPORT_BAND_GRID}>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              PV → Speicher
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {Math.round(
                                speicherGrenz.averageChargeLossPvToBatteryKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}{" "}
                              kWh/Jahr
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Zellverluste beim Laden
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {Math.round(
                                speicherGrenz.averageChargeLossChemicalKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}{" "}
                              kWh/Jahr
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Zellverluste beim Entladen
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {Math.round(
                                speicherGrenz.averageDischargeLossChemicalKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}{" "}
                              kWh/Jahr
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Speicher → AC-Bus
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {Math.round(
                                speicherGrenz
                                  .averageDischargeLossBatteryToAcKwh[
                                  physicalKpiLookupSize
                                ] ?? 0
                              )}{" "}
                              kWh/Jahr
                            </dd>
                          </div>
                          <div>
                            <dt className={REPORT_DATA_LABEL}>
                              Selbstentladung
                            </dt>
                            <dd className={REPORT_DATA_VALUE}>
                              {typeof avgSelfDischargeLossDisplayKwh ===
                                "number" &&
                              Number.isFinite(avgSelfDischargeLossDisplayKwh)
                                ? `${Math.round(avgSelfDischargeLossDisplayKwh)} kWh/Jahr`
                                : PLACEHOLDER}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ) : (
                      <div className="mt-8 border-t border-line-soft pt-4">
                        <div className={REPORT_METRIC_ROW}>
                          <div className={REPORT_METRIC_LABEL}>
                            <span className="block leading-snug">
                              Batterieverluste
                            </span>
                            <span
                              className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0.5`}
                            >
                              Für dieses Ergebnis liegt keine aufgeschlüsselte
                              Verlustbilanz vor.
                            </span>
                          </div>
                          <div className={REPORT_METRIC_VALUE}>
                            {PLACEHOLDER}
                          </div>
                        </div>
                      </div>
                    )}
                </section>

                <section className={REPORT_SECTION}>
                  <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
                    Eigenverbrauch vs Speichergröße
                  </h2>

                  <SpeicherChart
                    data={chart.data}
                    recommendedTechnicalSize={recommendedTechnicalSize}
                  />

                  <div className="mt-4 max-w-reading text-sm leading-relaxed text-ink-secondary">
                    Der zusätzliche Eigenverbrauch nimmt mit wachsender
                    Speichergröße deutlich ab. Ab einem bestimmten Punkt bringt
                    mehr Speicher nur noch geringen Mehrwert.
                  </div>
                </section>
              </>
            )}

            {robustness ? (
              <WpuqRobustnessSection
                robustness={robustness}
                bdew={{
                  eigenverbrauchKwh: recommendedEV ?? null,
                  eigenverbrauchsquotePct: eigenverbrauchsquoteMitSpeicherPct,
                  autarkiePct: autarkieMitPct,
                }}
              />
            ) : null}

            {/*
              Written conclusion: prose argument on the left, compact key figures
              on the right (same split pattern as the recommendation section).
              Methodological notes and Hinweis stay full-width below.
            */}
            <section className={REPORT_SECTION}>
              <h2 className={`mb-6 ${REPORT_SECTION_HEADING}`}>
                Unsere Einschätzung
              </h2>
              {recommendedTechnicalSize > 0 ? (
                <>
                  <div className={REPORT_SPLIT}>
                    <div className="min-w-0">
                      {/* The result of the report, restated in one compact group. */}
                      <div className="space-y-3">
                        <p className={REPORT_CONCLUSION_BODY}>
                          Die planerische Kaufempfehlung für Ihr Gebäude beträgt{" "}
                          <strong className="font-semibold text-ink">
                            {recommendedPlanningSize} kWh
                          </strong>{" "}
                          (planerische Anfangskapazität).
                        </p>
                        <p className={REPORT_CONCLUSION_BODY}>
                          Die physikalische Simulation ermittelt eine technische
                          Speichergrenze von{" "}
                          <strong className="font-semibold text-ink">
                            {recommendedTechnicalSize} kWh nutzbarer Kapazität
                          </strong>
                          .
                        </p>
                        <p className={REPORT_CONCLUSION_CONTEXT}>
                          Die planerische Anfangskapazität von{" "}
                          <strong className="font-semibold text-ink">
                            {recommendedPlanningSize} kWh
                          </strong>{" "}
                          enthält zusätzlich eine pauschale Alterungsreserve
                          (Planungsannahme: ca. 75&nbsp;% Restkapazität nach etwa
                          10 Jahren).
                        </p>
                        {hasActiveBackupReserve && (
                          <p className={REPORT_CONCLUSION_CONTEXT}>
                            Die Berechnung berücksichtigt eine Notstromreserve von{" "}
                            {resolvedBackupReserveKwh} kWh.
                          </p>
                        )}
                      </div>

                      {/* Caveat on the result above — ruled, not boxed. */}
                      {planningExceedsSimulatedRange && (
                        <p className="mt-5 border-l-2 border-warning pl-5 text-sm leading-relaxed text-warning">
                          Die planerische Anfangskapazität liegt außerhalb des
                          simulierten Speicherbereichs von 5–30 kWh.
                        </p>
                      )}

                      {/* What the simulation adds, ending in the Plateau finding. */}
                      <p className={`mt-8 ${REPORT_CONCLUSION_CONTEXT}`}>
                        Gleichzeitig zeigt die Simulation:
                      </p>
                      <p className={`mt-1 ${REPORT_CONCLUSION_BODY}`}>
                        Ab etwa{" "}
                        <strong className="font-semibold text-ink">
                          {recommendedTechnicalSize} kWh
                        </strong>{" "}
                        nimmt der zusätzliche Nutzen deutlich ab.
                      </p>

                      <div className="mt-5 border-l-2 border-accent pl-5">
                        <p className="text-sm font-semibold text-accent-text">
                          Plateau erreicht
                        </p>
                        <p className={`mt-1.5 ${REPORT_CONCLUSION_BODY}`}>
                          Ab diesem Punkt bringt zusätzlicher Speicher nur noch
                          sehr geringen Mehrwert.
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                          Die technische Speichergrenze liegt unmittelbar vor dem
                          ersten weiteren Kapazitätsschritt, der den jährlichen
                          Eigenverbrauch um weniger als 50&nbsp;kWh erhöht.
                        </p>
                      </div>

                      {/* What that means in practice — run-in, not a pseudo-heading. */}
                      <p className={`mt-8 ${REPORT_CONCLUSION_BODY}`}>
                        <strong className="font-semibold">Das bedeutet:</strong>{" "}
                        Ein größerer Speicher wäre technisch möglich, würde unter
                        den heutigen Bedingungen jedoch nur einen geringen
                        zusätzlichen Nutzen bringen.
                      </p>
                    </div>

                    <dl className={`${REPORT_SPLIT_ASIDE} space-y-0`}>
                      <div className={`${REPORT_DATA_ITEM} lg:border-t-0 lg:pt-0`}>
                        <dt className={REPORT_DATA_LABEL}>
                          Planerische Kaufempfehlung
                        </dt>
                        <dd
                          className={`${REPORT_DATA_VALUE} font-semibold text-accent-text`}
                        >
                          {recommendedPlanningSize} kWh
                        </dd>
                      </div>
                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>
                          Technische Speichergrenze
                        </dt>
                        <dd className={REPORT_DATA_VALUE}>
                          {recommendedTechnicalSize} kWh
                        </dd>
                      </div>
                      <div className={REPORT_DATA_ITEM}>
                        <dt className={REPORT_DATA_LABEL}>Plateau ab</dt>
                        <dd className={REPORT_DATA_VALUE}>
                          {recommendedTechnicalSize} kWh
                        </dd>
                      </div>
                      {hasActiveBackupReserve && (
                        <div className={REPORT_DATA_ITEM}>
                          <dt className={REPORT_DATA_LABEL}>Notstromreserve</dt>
                          <dd className={REPORT_DATA_VALUE}>
                            {resolvedBackupReserveKwh} kWh
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div className="mt-10 max-w-reading space-y-2.5 border-t border-line-soft pt-6">
                    <p className={REPORT_NOTE}>
                      Die technische Speichergrenze wird ausschließlich anhand
                      der physikalischen Simulation berechnet.
                    </p>
                    <p className={REPORT_NOTE}>
                      Die planerische Kaufempfehlung berücksichtigt zusätzlich
                      eine einheitliche Alterungsreserve. Sie ist keine Prognose
                      der tatsächlichen Batteriealterung und keine
                      Herstellergarantie.
                    </p>
                    <p className={REPORT_NOTE}>
                      Die Berechnung basiert auf einer Simulation in
                      15-Minuten-Schritten (35.040 Zeitschritte pro Jahr). Die
                      75-%-Planungsannahme
                      beeinflusst die Simulation nicht, sondern ausschließlich
                      die planerische Kaufempfehlung.
                    </p>
                    {hasActiveBackupReserve && (
                      <>
                        <p className={REPORT_NOTE}>
                          Durch die aktivierte Notstromreserve steht ein Teil
                          des Speichers im Alltag nicht zur Verfügung.
                        </p>
                        <p className={REPORT_NOTE}>
                          Dadurch sinken Eigenverbrauch und Autarkie leicht.
                        </p>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="max-w-reading text-sm leading-relaxed text-ink">
                  Unter den aktuellen Annahmen ist kein Batteriespeicher
                  technisch erforderlich. Die Simulation zeigt, dass ein
                  zusätzlicher Speicher den Eigenverbrauch unter diesen
                  Bedingungen kaum erhöht.
                </p>
              )}
            </section>

            <ReportQuellenSection heatPump={heatPumpCitation} />

            {/* Disclaimer — closing footnote of the report, not a section */}
            <div className="mt-8 border-t border-line-soft pt-6 lg:mt-10">
              <p className="max-w-reading text-xs leading-relaxed text-ink-muted">
                <strong className="font-semibold text-ink-secondary">
                  Hinweis:
                </strong>{" "}
                Dies ist eine vereinfachte Ersteinschätzung auf Basis Ihrer
                Angaben. Die tatsächliche Wirtschaftlichkeit hängt von vielen
                weiteren Faktoren ab (Lastprofil, Stromtarif, Fördermittel,
                etc.). Für eine detaillierte Analyse empfehlen wir eine
                individuelle Beratung.
              </p>
              {calculationDurationMs !== null ? (
                <div className="mt-6 max-w-reading text-xs leading-relaxed text-ink-muted">
                  <p className="font-medium text-ink-secondary">
                    Berechnungsdauer
                  </p>
                  <p className="mt-0.5 tabular-nums">
                    {formatCalculationDurationDe(calculationDurationMs)}{" "}
                    Sekunden
                  </p>
                  <p className="mt-2">inkl.</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {getReportDurationInclusions({
                      heatPump: heatPumpCitation,
                      cohortSize:
                        robustness?.cohortSize ?? SMART_METER_HOUSEHOLD_COUNT,
                    }).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          {/* Actions — page controls on the canvas, aligned to the sheet edges */}
          <div className="max-w-sheet mx-auto mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Link href={calculationLink} className={BTN_PRIMARY}>
              Detaillierte Analyse ansehen
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

