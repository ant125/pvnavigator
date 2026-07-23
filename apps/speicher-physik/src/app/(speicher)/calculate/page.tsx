"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ANALYTICS_CARD_TEXT_HOVER } from "../analyticsCardHoverClasses";
import { SpeicherInput, type PvSurfaceInput } from "../types/speicher";
import { validateInput } from "../utils/validateInput";
import {
  calculateHouseholdConsumptionAction,
  type SpeicherGrenzPayload,
  type VerifiedResult,
} from "./actions";
import { deriveSpeicherBusinessMetrics } from "@/lib/deriveSpeicherBusinessMetrics";
import SpeicherChart from "@/components/SpeicherChart";

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

const LOADING_STEPS = [
  "Standort wird analysiert",
  "Lastprofil wird berechnet",
  "PV-Daten werden geladen",
  "Speicher wird optimiert",
] as const;

const BACKUP_RESERVE_RADIO_OPTIONS: ReadonlyArray<{
  kwh: number;
  label: string;
  recommended?: boolean;
}> = [
  { kwh: 1.5, label: "1.5 kWh" },
  { kwh: 2.0, label: "2.0 kWh", recommended: true },
  { kwh: 3.0, label: "3.0 kWh" },
];

/** Shared label/value rows: Ausgangsdaten + Technische Kennzahlen */
const SPEICHER_REPORT_ROWS =
  "flex flex-col gap-y-3 text-sm text-slate-300";

const SPEICHER_REPORT_KPI_ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 sm:grid-cols-2 sm:gap-x-6 sm:items-baseline";

const SPEICHER_REPORT_HELPER_TEXT =
  "text-[10px] sm:text-[11px] leading-snug text-slate-500 font-normal normal-case";

/** Grouped hybrid breakdown under „Batterieverluste gesamt“ (own value column, not main KPI) */
const SPEICHER_BATTERY_LOSS_BREAKDOWN_GROUP =
  "mt-2 max-w-[min(100%,430px)] border-l border-slate-700/60 pl-4 space-y-1";

const SPEICHER_BATTERY_LOSS_BREAKDOWN_ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-[11px] sm:text-xs text-slate-400";

const SPEICHER_BATTERY_LOSS_BREAKDOWN_LABEL =
  "min-w-0 leading-snug text-slate-400";

const SPEICHER_BATTERY_LOSS_BREAKDOWN_VALUE =
  "shrink-0 tabular-nums text-right text-slate-300 text-[11px] sm:text-xs";

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
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-slate-900 px-4 py-3 text-left text-slate-100 outline-none transition-colors ${
          open
            ? "border-green-500 ring-1 ring-green-500"
            : "border-slate-700 focus:border-green-500 focus:ring-1 focus:ring-green-500"
        }`}
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
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
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg [scrollbar-color:theme(colors.slate.700)_theme(colors.slate.900)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb:hover]:bg-slate-600"
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
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-green-500/10 text-green-400"
                      : "text-slate-100 hover:bg-slate-800"
                  }`}
                >
                  <span className="min-w-0 truncate">{opt.label}</span>
                  {isSelected && (
                    <svg
                      className="h-4 w-4 shrink-0 text-green-400"
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
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [verifiedResult, setVerifiedResult] = useState<VerifiedResult | null>(
    null
  );
  const [speicherGrenz, setSpeicherGrenz] =
    useState<SpeicherGrenzPayload | null>(null);
  const [calculationLink, setCalculationLink] = useState<string>("/result");

  // Form state
  const [formData, setFormData] = useState<Partial<SpeicherInput>>({
    pvSurfaces: [{ ...DEFAULT_SURFACE }],
    address: "",
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
    if (step !== "calculating") return;
    setLoadingStepIndex(0);
    const timer = setInterval(() => {
      setLoadingStepIndex((i) =>
        i < LOADING_STEPS.length - 1 ? i + 1 : i
      );
    }, 800);
    return () => clearInterval(timer);
  }, [step]);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    const validation = validateInput(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);
    setStep("calculating");

    try {
      const pvSurfaces = surfacesOrDefault(formData).map((s) => ({
        systemSizeKwP: s.systemSizeKwP,
        tiltDeg: s.tiltDeg,
        azimuthDeg: s.azimuthDeg,
      }));
      const totalKwP = sumSurfaceKwP(pvSurfaces);

      const response = await calculateHouseholdConsumptionAction({
        annualConsumptionKWh: formData.annualConsumptionKwh as number,
        pvSystemKwP: totalKwP,
        latitude: 48.137154,
        longitude: 11.576124,
        tiltDeg: pvSurfaces[0].tiltDeg,
        azimuthDeg: pvSurfaces[0].azimuthDeg,
        pvSurfaces,
        heatPumpEnabled: formData.heatPumpEnabled === true,
        heatPumpConsumptionKWh: formData.heatPumpConsumptionKwh,
        backupReserveKwh: formData.backupReserveKwh,
      });

      setVerifiedResult(response.verifiedResult);
      setSpeicherGrenz(response.speicherGrenz);
      setCalculationLink("/result");
      setStep("results");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Die Berechnung ist fehlgeschlagen. Bitte versuchen Sie es erneut.";
      setErrors([message]);
      setStep("input");
    }
  };

  /**
   * Reset and start over
   */
  const handleReset = () => {
    setStep("input");
    setVerifiedResult(null);
    setSpeicherGrenz(null);
    setCalculationLink("/result");
    setErrors([]);
  };

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
    batteryTotalDischargedAvgKwh,
    batterieverlusteModellGesamtKwh,
    avgSelfDischargeLossDisplayKwh,
    avgAuxiliaryConsumptionDisplayKwh,
    eigenverbrauchMitSpeicher,
    autarkieOhnePct,
    autarkieMitPct,
    deltaEigenverbrauch,
    resolvedBackupReserveKwh,
    pvYieldKwhAnnual,
    specificYieldKwhPerKwp,
    netzbezugMitSpeicherKwhYear,
    einspeisungRechnerischKwhYear,
    eigenverbrauchsquoteMitSpeicherPct,
  } = metrics;

  const differenzBatterieflussKwh =
    typeof batteryGeladenAvgKwh === "number" &&
    Number.isFinite(batteryGeladenAvgKwh) &&
    typeof batteryTotalDischargedAvgKwh === "number" &&
    Number.isFinite(batteryTotalDischargedAvgKwh)
      ? Math.round(batteryGeladenAvgKwh - batteryTotalDischargedAvgKwh)
      : null;

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

  const deltaAutarkie =
    autarkieMitPct !== null && autarkieOhnePct !== null
      ? Math.round(autarkieMitPct - autarkieOhnePct)
      : null;

  const hasActiveBackupReserve =
    typeof resolvedBackupReserveKwh === "number" &&
    Number.isFinite(resolvedBackupReserveKwh) &&
    resolvedBackupReserveKwh > 0;

  return (
    <div className="py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* ========== INPUT STEP ========== */}
        {step === "input" && (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">
                SpeicherGrenze – Ihre Analyse
              </h1>
              <p className="text-slate-400">
                Geben Sie Ihre Daten ein und erhalten Sie eine erste Einschätzung.
              </p>
            </div>

            {/* Error display */}
            {errors.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <p className="text-sm font-semibold text-rose-300 mb-2">
                  Bitte korrigieren Sie folgende Fehler:
                </p>
                <ul className="text-sm text-rose-200/70 list-disc list-inside">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* PV: one or multiple roof surfaces */}
              <div className="space-y-6">
                {surfaces.map((surface, planeIndex) => (
                  <div key={planeIndex} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-200">
                        Dachfläche {planeIndex + 1}
                      </h2>
                      {planeIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => removeSurface(planeIndex)}
                          className="text-xs rounded-lg border border-slate-600 px-3 py-1.5 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 transition-colors"
                        >
                          Diese Fläche entfernen
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-200">
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
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-colors"
                        placeholder="z.B. 10"
                      />
                      {planeIndex === 0 && (
                        <p className="text-xs text-slate-500">
                          Die Größe Ihrer bestehenden oder geplanten PV-Anlage
                          auf dieser Dachfläche.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-200">
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
                          <label className="block text-sm font-medium text-slate-200">
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
                            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-colors"
                          />
                          <p className="text-xs text-slate-500">
                            0° = Nord, 90° = Ost, 180° = Süd, 270° = West.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-200">
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
                          <label className="block text-sm font-medium text-slate-200">
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
                            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-colors"
                          />
                          <p className="text-xs text-slate-500">
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
                  className="text-sm rounded-full border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 transition-colors"
                >
                  Weitere Dachfläche hinzufügen
                </button>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">
                  Standort / Adresse *
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-colors"
                  placeholder="z.B. München oder 80331"
                />
                <p className="text-xs text-slate-500">
                  Für die Berechnung der lokalen Sonneneinstrahlung.
                </p>
              </div>

              {/* Annual Consumption */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">
                  Hausverbrauch (ohne Wärmepumpe) *
                </label>
                <input
                  type="number"
                  min="500"
                  max="50000"
                  value={formData.annualConsumptionKwh || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      annualConsumptionKwh:
                        parseInt(e.target.value) || undefined,
                    })
                  }
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-colors"
                  placeholder="z.B. 4500"
                />
                <p className="text-xs text-slate-500">
                  Bitte geben Sie hier nur den Haushaltsstromverbrauch ein – ohne
                  Wärmepumpe.
                </p>
              </div>

              {/* Heat pump */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="heatPumpEnabled"
                    checked={formData.heatPumpEnabled === true}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        heatPumpEnabled: e.target.checked,
                        ...(e.target.checked
                          ? {}
                          : { heatPumpConsumptionKwh: undefined }),
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-slate-200">
                    Wärmepumpe vorhanden
                  </span>
                </label>
                {formData.heatPumpEnabled && (
                  <div className="space-y-2 pl-7">
                    <label className="block text-sm font-medium text-slate-200">
                      Stromverbrauch Wärmepumpe (kWh/Jahr)
                    </label>
                    <input
                      type="number"
                      name="heatPumpConsumptionKwh"
                      min="1"
                      value={formData.heatPumpConsumptionKwh ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          heatPumpConsumptionKwh:
                            parseInt(e.target.value, 10) || undefined,
                        })
                      }
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-colors"
                      placeholder="z. B. 5000"
                    />
                    <p className="text-xs text-slate-500">
                      Falls vorhanden: separater Stromverbrauch Ihrer Wärmepumpe.
                    </p>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Viele Haushalte haben mit Wärmepumpe einen deutlich höheren
                  Stromverbrauch im Winter. Diese wird hier separat
                  berücksichtigt.
                </p>
              </div>

              {/* Notstromreserve */}
              <div className="space-y-3">
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
                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-slate-200">
                    Notstromreserve aktivieren
                  </span>
                </label>
                {(formData.backupReserveKwh ?? 0) > 0 && (
                  <div className="space-y-2 pl-7 mt-3">
                    <span className="block text-sm font-medium text-slate-200">
                      Reservierte Kapazität
                    </span>
                    <div className="flex flex-col gap-2">
                      {BACKUP_RESERVE_RADIO_OPTIONS.map((opt) => (
                        <label
                          key={opt.kwh}
                          className="flex items-center gap-2 cursor-pointer text-sm text-slate-100"
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
                            className="h-4 w-4 border-slate-600 bg-slate-900 text-green-500 focus:ring-green-500"
                          />
                          <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                            <span>{opt.label}</span>
                            {opt.recommended && (
                              <span className="text-xs text-emerald-400/70 font-normal">
                                (empfohlen)
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Ein Teil des Speichers wird für Notfälle reserviert und im
                  Alltag nicht genutzt.
                  <br />
                  Dies reduziert leicht Eigenverbrauch und Autarkie.
                </p>
              </div>

              {/* Submit */}
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 active:scale-[0.98] transition-all duration-200 hover:scale-[1.03] shadow-[0_0_0_rgba(0,0,0,0)] hover:shadow-[0_0_20px_rgba(34,197,94,0.25)] text-white font-semibold"
                >
                  Berechnung starten
                </button>
              </div>
            </form>

            {/* Disclaimer */}
            <p className="mt-6 text-xs text-slate-500 text-center">
              * Pflichtfelder. Ihre Daten werden nicht gespeichert.
            </p>
          </>
        )}

        {/* ========== CALCULATING STEP ========== */}
        {step === "calculating" && (
          <div
            className="items-center py-20"
            style={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {/* Spinner */}
            <div className="relative mb-6">
              <div className="w-16 h-16 border-4 border-slate-700 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-green-500 rounded-full border-t-transparent animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-slate-100 mb-2">
              Berechnung läuft...
            </h2>
            <p className="text-slate-400 text-sm text-center max-w-md px-4 mb-6">
              Wir analysieren Ihre Daten… Das dauert nur wenige Sekunden.
            </p>
            <ul className="flex flex-col gap-2 w-full max-w-sm px-4">
              {LOADING_STEPS.map((label, i) => {
                if (i < loadingStepIndex) {
                  return (
                    <li
                      key={label}
                      className="text-sm flex items-center gap-2 justify-center text-emerald-500"
                    >
                      <span aria-hidden>✔</span>
                      <span>{label}</span>
                    </li>
                  );
                }
                if (i === loadingStepIndex) {
                  return (
                    <li
                      key={label}
                      className="text-sm flex items-center gap-2 justify-center font-medium text-slate-100"
                    >
                      <span
                        className="inline-block w-3.5 h-3.5 shrink-0 border-2 border-green-500 border-t-transparent rounded-full animate-spin"
                        aria-hidden
                      />
                      <span>{label}</span>
                    </li>
                  );
                }
                return (
                  <li
                    key={label}
                    className="text-sm flex items-center gap-2 justify-center"
                    style={{ color: "#64748b" }}
                  >
                    <span className="w-3.5 shrink-0" aria-hidden />
                    <span>{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ========== RESULTS STEP ========== */}
        {step === "results" && (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 mb-4">
                <svg
                  className="w-4 h-4 text-emerald-400 opacity-90"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-xs text-emerald-400 opacity-90 font-medium">
                  Analyse abgeschlossen
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">
                Ihre Speicher-Analyse
              </h1>
            </div>

            {/* Result Cards */}
            <div className="space-y-4 mb-8">
              {/* Recommended Size */}
              <div className="p-6 rounded-2xl bg-[#0F1620] border border-white/5 group">
                <div
                  className={`flex items-center justify-between ${ANALYTICS_CARD_TEXT_HOVER}`}
                >
                  <div className="min-w-0 flex-1">
                    {recommendedTechnicalSize > 0 ? (
                      <>
                        <p className="text-sm text-slate-400">
                          Empfohlene Speichergröße
                        </p>
                        <p className="text-3xl font-bold text-emerald-400 opacity-90">
                          {recommendedPlanningSize} kWh
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-slate-400">
                          Die technische Simulation zeigt, dass für Ihr
                          Verbrauchsprofil heute bereits etwa{" "}
                          <strong className="font-semibold text-slate-300">
                            {recommendedTechnicalSize} kWh nutzbare
                            Speicherkapazität
                          </strong>{" "}
                          ausreichen.
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-slate-400">
                          Viele Hersteller moderner Batteriespeicher geben nach
                          rund <strong className="font-semibold text-slate-300">10 Jahren</strong>{" "}
                          oder einer bestimmten Anzahl von Ladezyklen eine
                          verbleibende nutzbare Speicherkapazität von etwa{" "}
                          <strong className="font-semibold text-slate-300">
                            70–80&nbsp;%
                          </strong>{" "}
                          der ursprünglichen Kapazität an.
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-slate-400">
                          Deshalb empfehlen wir für die Kaufentscheidung eine{" "}
                          <strong className="font-semibold text-slate-300">
                            Speichergröße von {recommendedPlanningSize} kWh
                          </strong>
                          . Dadurch bleibt voraussichtlich auch nach einer
                          möglichen Kapazitätsabnahme genügend nutzbare
                          Speicherkapazität erhalten.
                        </p>
                        <p className="mt-3 text-xs italic leading-relaxed text-slate-500">
                          Die angenommene Kapazitätsabnahme ist eine
                          Planungsannahme und keine Garantie für die tatsächliche
                          Alterung eines bestimmten Batteriespeichers.
                        </p>
                        {planningExceedsSimulatedRange && (
                          <p className="mt-3 text-sm leading-relaxed text-amber-400/90">
                            Die empfohlene Anfangskapazität liegt außerhalb des
                            simulierten Speicherbereichs von 5–30 kWh.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-slate-400">
                          Speicherempfehlung
                        </p>
                        <p className="mt-2 text-lg font-semibold leading-relaxed text-slate-200">
                          Unter den aktuellen Annahmen ist kein Batteriespeicher
                          technisch erforderlich.
                        </p>
                      </>
                    )}
                  </div>
                  <div className="w-14 h-14 shrink-0 rounded-xl bg-emerald-400/10 flex items-center justify-center ml-4">
                    <svg
                      className="w-7 h-7 text-emerald-400 opacity-90"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Self Consumption */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0F1620] border border-white/5 group">
                  <div className={ANALYTICS_CARD_TEXT_HOVER}>
                    <p className="text-xs text-slate-400 mb-1">
                      Eigenverbrauch ohne Speicher (jährlich)
                    </p>
                    <p className="text-2xl font-bold text-slate-300">
                      {formatKwh(
                        verifiedResult?.energy.year.selfConsumptionWithoutStorage
                      )}
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#0F1620] border border-white/5 group">
                  <div className={ANALYTICS_CARD_TEXT_HOVER}>
                    <p className="text-xs text-slate-400 mb-1">
                      Eigenverbrauch mit Speicher
                    </p>
                    <p className="text-2xl font-bold text-emerald-400 opacity-90">
                      {formatKwh(recommendedEV)}
                    </p>
                    {deltaEigenverbrauch !== null && (
                      <p className="text-sm mt-1 font-medium text-emerald-500">
                        ({deltaEigenverbrauch >= 0 ? "+" : ""}
                        {deltaEigenverbrauch} kWh)
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#0F1620] border border-white/5 group">
                  <div className={ANALYTICS_CARD_TEXT_HOVER}>
                    <p className="text-xs text-slate-400 mb-1">
                      Autarkie ohne Speicher:
                    </p>
                    <p className="text-2xl font-bold text-slate-300">
                      {autarkieOhnePct !== null
                        ? `${autarkieOhnePct} %`
                        : PLACEHOLDER}
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#0F1620] border border-white/5 group">
                  <div className={ANALYTICS_CARD_TEXT_HOVER}>
                    <p className="text-xs text-slate-400 mb-1">
                      Autarkie mit Speicher:
                    </p>
                    <p className="text-2xl font-bold text-emerald-400 opacity-90">
                      {autarkieMitPct !== null
                        ? `${autarkieMitPct} %`
                        : PLACEHOLDER}
                    </p>
                    {deltaAutarkie !== null && (
                      <p className="text-sm mt-1 font-medium text-emerald-500">
                        ({deltaAutarkie >= 0 ? "+" : ""}
                        {deltaAutarkie}%)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {speicherGrenz && (
              <>
                <div className="bg-[#0F1620] rounded-xl p-4 sm:p-6 mb-8 border border-white/5 group">
                  <div className={ANALYTICS_CARD_TEXT_HOVER}>
                    <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300 sm:mb-4">
                      Ausgangsdaten
                    </div>

                    <div className={SPEICHER_REPORT_ROWS}>
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-4 gap-y-1 sm:grid-cols-2 sm:gap-x-6 sm:items-baseline">
                        <div className="min-w-0 leading-snug text-slate-400">
                          Adresse:
                        </div>
                        <div className="min-w-0 break-words whitespace-normal text-left font-medium text-slate-100">
                          {formData.address ?? "—"}
                        </div>
                      </div>

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          PV-Anlage:
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100">
                          <span>
                            {Number.isFinite(totalKwPConfigured)
                              ? formatKwpDisplay(totalKwPConfigured)
                              : PLACEHOLDER}{" "}
                            kWp
                          </span>
                          {surfaces.length > 1 && (
                            <span className="text-slate-400 font-normal">{` auf ${surfaces.length} Dachflächen`}</span>
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
                        </div>
                      </div>

                      {surfaces.length === 1 && (
                        <>
                          <div className={SPEICHER_REPORT_KPI_ROW}>
                            <div className="min-w-0 leading-snug text-slate-400">
                              Neigung:
                            </div>
                            <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100">
                              {surfaces[0]?.tiltDeg}°
                            </div>
                          </div>

                          <div className={SPEICHER_REPORT_KPI_ROW}>
                            <div className="min-w-0 leading-snug text-slate-400">
                              Ausrichtung:
                            </div>
                            <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100">
                              {surfaces[0]?.azimuthDeg}°
                            </div>
                          </div>
                        </>
                      )}

                      {hasActiveBackupReserve && (
                        <div className={SPEICHER_REPORT_KPI_ROW}>
                          <div className="min-w-0 leading-snug text-slate-400">
                            Notstromreserve:
                          </div>
                          <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100">
                            {resolvedBackupReserveKwh} kWh
                          </div>
                        </div>
                      )}

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Hausverbrauch (ohne Wärmepumpe):
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100">
                          {formData.annualConsumptionKwh} kWh/Jahr
                        </div>
                      </div>

                      {formData.heatPumpEnabled === true && (
                        <div className={SPEICHER_REPORT_KPI_ROW}>
                          <div className="min-w-0 leading-snug text-slate-400">
                            Wärmepumpe:
                          </div>
                          <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100">
                            {formData.heatPumpConsumptionKwh} kWh/Jahr
                          </div>
                        </div>
                      )}

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Gesamtverbrauch:
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100">
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
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0F1620] rounded-xl p-4 sm:p-6 mb-8 border border-white/5 group">
                  <div className={ANALYTICS_CARD_TEXT_HOVER}>
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-1">
                      Technische Kennzahlen
                    </h3>
                    <p className="mb-3 text-xs leading-relaxed text-slate-500 sm:mb-4">
                      Alle technischen Kennzahlen beziehen sich auf die technisch
                      ermittelte Speichergrenze von{" "}
                      <strong className="font-semibold text-slate-400">
                        {recommendedTechnicalSize} kWh
                      </strong>{" "}
                      und nicht auf die größere Kaufempfehlung.
                    </p>

                    <dl className={SPEICHER_REPORT_ROWS}>
                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Jahresertrag PV
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100 sm:text-left">
                          {typeof pvYieldKwhAnnual === "number" &&
                          Number.isFinite(pvYieldKwhAnnual)
                            ? `${pvYieldKwhAnnual.toFixed(0)} kWh/Jahr`
                            : PLACEHOLDER}
                        </div>
                      </div>

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Spezifischer Ertrag
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100 sm:text-left">
                          {specificYieldKwhPerKwp !== null
                            ? `${specificYieldKwhPerKwp.toFixed(1)} kWh/kWp`
                            : PLACEHOLDER}
                        </div>
                      </div>

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Direktverbrauch ohne Speicher
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100 sm:text-left">
                          {formatKwh(
                            verifiedResult?.energy.year.selfConsumptionWithoutStorage
                          )}
                        </div>
                      </div>

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Eigenverbrauch mit Speicher
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-emerald-400/90 sm:text-left">
                          {formatKwh(eigenverbrauchMitSpeicher)}
                        </div>
                      </div>

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Batterie geladen
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100 sm:text-left">
                          {typeof batteryGeladenAvgKwh === "number" &&
                          Number.isFinite(batteryGeladenAvgKwh)
                            ? `${Math.round(batteryGeladenAvgKwh)} kWh/Jahr`
                            : PLACEHOLDER}
                        </div>
                      </div>

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Batterie an Verbrauch
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100 sm:text-left">
                          {typeof batteryAnVerbrauchAvgKwh === "number" &&
                          Number.isFinite(batteryAnVerbrauchAvgKwh)
                            ? `${Math.round(batteryAnVerbrauchAvgKwh)} kWh/Jahr`
                            : PLACEHOLDER}
                        </div>
                      </div>

                      {speicherGrenz && showBatterieverlusteHybridBreakdown ? (
                        <>
                          <div className={SPEICHER_REPORT_KPI_ROW}>
                            <div className="min-w-0 leading-snug text-slate-400">
                              <span className="block leading-snug">
                                Batterieverluste gesamt
                              </span>
                              <span
                                className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0 sm:mt-0.5`}
                              >
                                Modell: Lade- + Entladeverluste
                                (Mehrjahresmittel).
                              </span>
                            </div>
                            <div className="min-w-0 shrink-0 self-start text-left tabular-nums font-medium text-slate-100 sm:self-center sm:text-left">
                              {batterieverlusteModellGesamtKwh !== null
                                ? `${batterieverlusteModellGesamtKwh} kWh/Jahr`
                                : PLACEHOLDER}
                            </div>
                          </div>
                          <div className={SPEICHER_BATTERY_LOSS_BREAKDOWN_GROUP}>
                            <div className={SPEICHER_BATTERY_LOSS_BREAKDOWN_ROW}>
                              <span className={SPEICHER_BATTERY_LOSS_BREAKDOWN_LABEL}>
                                PV → Speicher
                              </span>
                              <span className={SPEICHER_BATTERY_LOSS_BREAKDOWN_VALUE}>
                                {Math.round(
                                  speicherGrenz.averageChargeLossPvToBatteryKwh[
                                    physicalKpiLookupSize
                                  ] ?? 0
                                )}{" "}
                                kWh/Jahr
                              </span>
                            </div>
                            <div className={SPEICHER_BATTERY_LOSS_BREAKDOWN_ROW}>
                              <span className={SPEICHER_BATTERY_LOSS_BREAKDOWN_LABEL}>
                                Zellverluste beim Laden
                              </span>
                              <span className={SPEICHER_BATTERY_LOSS_BREAKDOWN_VALUE}>
                                {Math.round(
                                  speicherGrenz.averageChargeLossChemicalKwh[
                                    physicalKpiLookupSize
                                  ] ?? 0
                                )}{" "}
                                kWh/Jahr
                              </span>
                            </div>
                            <div className={SPEICHER_BATTERY_LOSS_BREAKDOWN_ROW}>
                              <span className={SPEICHER_BATTERY_LOSS_BREAKDOWN_LABEL}>
                                Zellverluste beim Entladen
                              </span>
                              <span className={SPEICHER_BATTERY_LOSS_BREAKDOWN_VALUE}>
                                {Math.round(
                                  speicherGrenz.averageDischargeLossChemicalKwh[
                                    physicalKpiLookupSize
                                  ] ?? 0
                                )}{" "}
                                kWh/Jahr
                              </span>
                            </div>
                            <div className={SPEICHER_BATTERY_LOSS_BREAKDOWN_ROW}>
                              <span className={SPEICHER_BATTERY_LOSS_BREAKDOWN_LABEL}>
                                Speicher → AC-Bus
                              </span>
                              <span className={SPEICHER_BATTERY_LOSS_BREAKDOWN_VALUE}>
                                {Math.round(
                                  speicherGrenz.averageDischargeLossBatteryToAcKwh[
                                    physicalKpiLookupSize
                                  ] ?? 0
                                )}{" "}
                                kWh/Jahr
                              </span>
                            </div>
                            <div className={SPEICHER_BATTERY_LOSS_BREAKDOWN_ROW}>
                              <span className={SPEICHER_BATTERY_LOSS_BREAKDOWN_LABEL}>
                                Selbstentladung
                              </span>
                              <span className={SPEICHER_BATTERY_LOSS_BREAKDOWN_VALUE}>
                                {typeof avgSelfDischargeLossDisplayKwh ===
                                  "number" &&
                                Number.isFinite(avgSelfDischargeLossDisplayKwh)
                                  ? `${Math.round(avgSelfDischargeLossDisplayKwh)} kWh/Jahr`
                                  : PLACEHOLDER}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className={SPEICHER_REPORT_KPI_ROW}>
                          <div className="min-w-0 leading-snug text-slate-400">
                            <span className="block leading-snug">
                              Batterieverluste
                            </span>
                            <span
                              className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0 sm:mt-0.5`}
                            >
                              Beinhaltet Lade-/Entladeverluste sowie geringe
                              systembedingte Abweichungen.
                            </span>
                          </div>
                          <div className="min-w-0 shrink-0 self-start text-left tabular-nums font-medium text-slate-100 sm:self-center sm:text-left">
                            {differenzBatterieflussKwh !== null
                              ? `${differenzBatterieflussKwh} kWh/Jahr`
                              : PLACEHOLDER}
                          </div>
                        </div>
                      )}

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          <span className="block leading-snug">
                            Systemverbrauch Standby
                          </span>
                          <span
                            className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0 sm:mt-0.5`}
                          >
                            Separat bilanziert; nicht im Haushaltsverbrauch,
                            Eigenverbrauch oder Autarkiegrad enthalten.
                          </span>
                        </div>
                        <div className="min-w-0 shrink-0 self-start text-left tabular-nums font-medium text-slate-100 sm:self-center sm:text-left">
                          {typeof avgAuxiliaryConsumptionDisplayKwh ===
                            "number" &&
                          Number.isFinite(avgAuxiliaryConsumptionDisplayKwh)
                            ? `${Math.round(avgAuxiliaryConsumptionDisplayKwh)} kWh/Jahr`
                            : PLACEHOLDER}
                        </div>
                      </div>

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Netzbezug mit Speicher
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100 sm:text-left">
                          {typeof netzbezugMitSpeicherKwhYear === "number" &&
                          Number.isFinite(netzbezugMitSpeicherKwhYear)
                            ? `${netzbezugMitSpeicherKwhYear.toFixed(0)} kWh/Jahr`
                            : PLACEHOLDER}
                        </div>
                      </div>

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          <span className="block leading-snug">
                            Einspeisung (rechnerisch)
                          </span>
                          <span className={`block ${SPEICHER_REPORT_HELPER_TEXT} mt-0 sm:mt-0.5`}>
                            Grobe Größenordnung, nicht gleich EEG-Einspeisemenge
                          </span>
                        </div>
                        <div className="min-w-0 shrink-0 self-start text-left tabular-nums font-medium text-slate-100 sm:self-center sm:text-left">
                          {typeof einspeisungRechnerischKwhYear === "number" &&
                          Number.isFinite(einspeisungRechnerischKwhYear)
                            ? `${einspeisungRechnerischKwhYear.toFixed(0)} kWh/Jahr`
                            : PLACEHOLDER}
                        </div>
                      </div>

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Autarkiegrad mit Speicher
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-emerald-400/90 sm:text-left">
                          {autarkieMitPct !== null
                            ? `${autarkieMitPct} %`
                            : PLACEHOLDER}
                        </div>
                      </div>

                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Eigenverbrauchsquote
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100 sm:text-left">
                          {eigenverbrauchsquoteMitSpeicherPct !== null
                            ? `${eigenverbrauchsquoteMitSpeicherPct} %`
                            : PLACEHOLDER}
                        </div>
                      </div>
                    </dl>
                  </div>
                </div>

                <h2 className="text-xl font-semibold mb-4">
                  Eigenverbrauch vs Speichergröße
                </h2>

                <SpeicherChart
                  data={chart.data}
                  recommendedTechnicalSize={recommendedTechnicalSize}
                />

                <div className="mt-6 mb-8 text-slate-400 text-sm">
                  Der zusätzliche Eigenverbrauch nimmt mit wachsender
                  Speichergröße deutlich ab. Ab einem bestimmten Punkt bringt
                  mehr Speicher nur noch geringen Mehrwert.
                </div>
              </>
            )}

            {/* Recommendation */}
            <div className="mt-10 w-full min-w-0 p-6 rounded-2xl bg-[#0F1620] border border-white/5 group">
              <div className={`w-full min-w-0 ${ANALYTICS_CARD_TEXT_HOVER}`}>
                <h3 className="font-semibold text-emerald-400 opacity-90 mb-2">
                  Unsere Einschätzung
                </h3>
                <>
                  {recommendedTechnicalSize > 0 ? (
                    <>
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300">
                        Wir empfehlen für Ihr Gebäude eine{" "}
                        <strong className="font-semibold text-slate-200">
                          Speichergröße von {recommendedPlanningSize} kWh
                        </strong>
                        .
                      </p>
                      {planningExceedsSimulatedRange && (
                        <p className="w-full min-w-0 text-sm leading-6 text-amber-400/90 mt-3">
                          Die empfohlene Anfangskapazität liegt außerhalb des
                          simulierten Speicherbereichs von 5–30 kWh.
                        </p>
                      )}
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                        Die technische Simulation zeigt, dass bereits{" "}
                        <strong className="font-semibold text-slate-200">
                          etwa {recommendedTechnicalSize} kWh nutzbare Kapazität
                        </strong>{" "}
                        ausreichen, um den wirtschaftlich sinnvollen Bereich zu
                        erreichen.
                      </p>
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                        Die Empfehlung von{" "}
                        <strong className="font-semibold text-slate-200">
                          {recommendedPlanningSize} kWh
                        </strong>{" "}
                        berücksichtigt zusätzlich eine mögliche
                        Kapazitätsabnahme über die Nutzungsdauer des
                        Batteriespeichers.
                      </p>
                      {hasActiveBackupReserve && (
                        <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                          Die Berechnung berücksichtigt eine Notstromreserve von{" "}
                          {resolvedBackupReserveKwh} kWh.
                        </p>
                      )}
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                        Gleichzeitig zeigt die Simulation:
                      </p>
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                        Ab etwa{" "}
                        <strong className="font-semibold text-slate-200">
                          {recommendedTechnicalSize} kWh
                        </strong>{" "}
                        nimmt der zusätzliche Nutzen deutlich ab.
                      </p>
                      <div className="mt-3 w-full min-w-0 border-l border-emerald-500/30 pl-3">
                        <p className="text-emerald-300 font-medium">
                          Plateau erreicht
                        </p>
                        <p className="text-sm leading-6 text-slate-300 mt-1">
                          Ab diesem Punkt bringt zusätzlicher Speicher nur noch
                          sehr geringen Mehrwert.
                        </p>
                        <p className="text-sm leading-6 text-slate-300 mt-3">
                          Jede weitere kWh erhöht den Eigenverbrauch nur minimal
                          (unter ~1&nbsp;% pro zusätzlicher kWh).
                        </p>
                      </div>
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-4">
                        👉 Das bedeutet:
                      </p>
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                        Ein größerer Speicher wäre technisch möglich, würde unter
                        den heutigen Bedingungen jedoch nur einen geringen
                        zusätzlichen Nutzen bringen.
                      </p>
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                        Die technische Speichergrenze wird ausschließlich anhand
                        der physikalischen Simulation berechnet.
                      </p>
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                        Die empfohlene Speichergröße berücksichtigt zusätzlich
                        eine langfristige Planungsannahme zur möglichen
                        Kapazitätsabnahme moderner Batteriespeicher.
                      </p>
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                        Die Berechnung basiert auf einer stündlichen Simulation
                        (8760 Stunden pro Jahr). Die Alterungsannahme beeinflusst
                        die Simulation nicht, sondern ausschließlich die
                        Kaufempfehlung.
                      </p>
                      {hasActiveBackupReserve && (
                        <>
                          <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                            Durch die aktivierte Notstromreserve steht ein Teil
                            des Speichers im Alltag nicht zur Verfügung.
                          </p>
                          <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                            Dadurch sinken Eigenverbrauch und Autarkie leicht.
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="w-full min-w-0 text-sm leading-6 text-slate-300">
                      Unter den aktuellen Annahmen ist kein Batteriespeicher
                      technisch erforderlich. Die Simulation zeigt, dass ein
                      zusätzlicher Speicher den Eigenverbrauch unter diesen
                      Bedingungen kaum erhöht.
                    </p>
                  )}
                </>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-8 p-4 rounded-xl bg-[#0F1620] border border-white/5 mb-8 group">
              <div className={ANALYTICS_CARD_TEXT_HOVER}>
              <p className="text-xs text-slate-500">
                <strong className="text-slate-400">Hinweis:</strong> Dies ist
                eine vereinfachte Ersteinschätzung auf Basis Ihrer Angaben. Die
                tatsächliche Wirtschaftlichkeit hängt von vielen weiteren
                Faktoren ab (Lastprofil, Stromtarif, Fördermittel, etc.). Für
                eine detaillierte Analyse empfehlen wir eine individuelle
                Beratung.
              </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 rounded-full border border-white/10 bg-transparent text-white/80 hover:bg-white/5 hover:border-white/20 hover:text-white transition-all duration-200 hover:shadow-[0_0_12px_rgba(255,255,255,0.05)] font-medium"
              >
                Neue Berechnung
              </button>
              <Link
                href={calculationLink}
                className="flex-1 py-3 rounded-full text-center bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 active:scale-[0.98] transition-all duration-200 hover:scale-[1.03] shadow-[0_0_0_rgba(0,0,0,0)] hover:shadow-[0_0_20px_rgba(34,197,94,0.25)] text-white font-semibold"
              >
                Detaillierte Analyse ansehen
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

