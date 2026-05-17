"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ANALYTICS_CARD_TEXT_HOVER } from "../analyticsCardHoverClasses";
import { SpeicherInput, type PvSurfaceInput } from "../types/speicher";
import { validateInput } from "../utils/validateInput";
import {
  calculateHouseholdConsumptionAction,
  type SpeicherGrenzPayload,
  type VerifiedResult,
} from "./actions";
import { buildSpeicherChartData } from "@/lib/speicherChartData";
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

  const chart = buildSpeicherChartData({
    selfConsumptionWithoutStorage:
      speicherGrenz && verifiedResult
        ? verifiedResult.energy.year.selfConsumptionWithoutStorage
        : 0,
    batterySizes: speicherGrenz?.batterySizes ?? [],
    average: speicherGrenz?.average ?? {},
  });

  const recommendedSize = (() => {
    for (let i = 1; i < chart.data.length; i++) {
      if (chart.data[i].deltaEigenverbrauch < 50) {
        return chart.data[i - 1].size;
      }
    }
    return chart.data[chart.data.length - 1]?.size ?? 0;
  })();

  const recommendedEV = chart.data.find(
    (p) => p.size === recommendedSize
  )?.eigenverbrauch;

  const batteryGeladenAvgKwh =
    speicherGrenz && recommendedSize > 0
      ? speicherGrenz.averageBatteryChargedKwh[recommendedSize]
      : undefined;
  const batteryAnVerbrauchAvgKwh =
    speicherGrenz && recommendedSize > 0
      ? speicherGrenz.averageBatteryDischargedKwh[recommendedSize]
      : undefined;
  const differenzBatterieflussKwh =
    typeof batteryGeladenAvgKwh === "number" &&
    Number.isFinite(batteryGeladenAvgKwh) &&
    typeof batteryAnVerbrauchAvgKwh === "number" &&
    Number.isFinite(batteryAnVerbrauchAvgKwh)
      ? Math.round(batteryGeladenAvgKwh - batteryAnVerbrauchAvgKwh)
      : null;

  const avgChargeLossKwh =
    speicherGrenz && recommendedSize > 0
      ? speicherGrenz.averageChargeLossKwh[recommendedSize]
      : undefined;
  const avgDischargeLossKwh =
    speicherGrenz && recommendedSize > 0
      ? speicherGrenz.averageDischargeLossKwh[recommendedSize]
      : undefined;
  const batterieverlusteModellGesamtKwh =
    typeof avgChargeLossKwh === "number" &&
    Number.isFinite(avgChargeLossKwh) &&
    typeof avgDischargeLossKwh === "number" &&
    Number.isFinite(avgDischargeLossKwh)
      ? Math.round(avgChargeLossKwh + avgDischargeLossKwh)
      : null;

  const hybridChargeBreakdownAvgKwh =
    speicherGrenz && recommendedSize > 0
      ? (speicherGrenz.averageChargeLossPvToBatteryKwh[recommendedSize] ??
          0) +
        (speicherGrenz.averageChargeLossChemicalKwh[recommendedSize] ?? 0)
      : 0;
  const showBatterieverlusteHybridBreakdown =
    speicherGrenz != null &&
    recommendedSize > 0 &&
    batterieverlusteModellGesamtKwh !== null &&
    hybridChargeBreakdownAvgKwh > 1e-3;

  const avgSelfDischargeLossDisplayKwh =
    speicherGrenz && recommendedSize > 0
      ? speicherGrenz.averageSelfDischargeLossKwh[recommendedSize]
      : undefined;
  const avgAuxiliaryConsumptionDisplayKwh =
    speicherGrenz && recommendedSize > 0
      ? speicherGrenz.averageAuxiliaryConsumptionKwh[recommendedSize]
      : undefined;

  const totalConsumption =
    (formData.annualConsumptionKwh ?? 0) +
    (formData.heatPumpEnabled === true
      ? formData.heatPumpConsumptionKwh ?? 0
      : 0);

  const eigenverbrauchOhneSpeicher =
    verifiedResult?.energy.year.selfConsumptionWithoutStorage;
  const eigenverbrauchMitSpeicher = recommendedEV;

  const autarkieOhnePct =
    totalConsumption > 0 &&
    typeof eigenverbrauchOhneSpeicher === "number" &&
    Number.isFinite(eigenverbrauchOhneSpeicher)
      ? Math.round((eigenverbrauchOhneSpeicher / totalConsumption) * 100)
      : null;

  const autarkieMitPct =
    totalConsumption > 0 &&
    typeof eigenverbrauchMitSpeicher === "number" &&
    Number.isFinite(eigenverbrauchMitSpeicher)
      ? Math.round((eigenverbrauchMitSpeicher / totalConsumption) * 100)
      : null;

  const deltaEigenverbrauch =
    typeof eigenverbrauchMitSpeicher === "number" &&
    Number.isFinite(eigenverbrauchMitSpeicher) &&
    typeof eigenverbrauchOhneSpeicher === "number" &&
    Number.isFinite(eigenverbrauchOhneSpeicher)
      ? Math.round(
          eigenverbrauchMitSpeicher - eigenverbrauchOhneSpeicher
        )
      : null;

  const deltaAutarkie =
    autarkieMitPct !== null && autarkieOhnePct !== null
      ? Math.round(autarkieMitPct - autarkieOhnePct)
      : null;

  const resolvedBackupReserveKwh =
    verifiedResult?.backupReserveKwh ?? formData.backupReserveKwh ?? 0;
  const hasActiveBackupReserve =
    typeof resolvedBackupReserveKwh === "number" &&
    Number.isFinite(resolvedBackupReserveKwh) &&
    resolvedBackupReserveKwh > 0;

  const pvYieldKwhAnnual = verifiedResult?.energy.year.pvYieldKwhAnnual;

  const totalKwPConfigured = sumSurfaceKwP(surfaces);

  const specificYieldKwhPerKwp =
    typeof pvYieldKwhAnnual === "number" &&
    Number.isFinite(pvYieldKwhAnnual) &&
    totalKwPConfigured > 0 &&
    Number.isFinite(totalKwPConfigured)
      ? pvYieldKwhAnnual / totalKwPConfigured
      : null;

  const ledgerGridImportAvgKwh =
    speicherGrenz && recommendedSize > 0
      ? speicherGrenz.averageGridToHouseholdKwh[recommendedSize] +
        speicherGrenz.averageGridToAuxiliaryKwh[recommendedSize]
      : undefined;
  const ledgerGridExportAvgKwh =
    speicherGrenz && recommendedSize > 0
      ? speicherGrenz.averageGridExportKwh[recommendedSize]
      : undefined;

  const netzbezugMitSpeicherKwhYear =
    typeof ledgerGridImportAvgKwh === "number" &&
    Number.isFinite(ledgerGridImportAvgKwh)
      ? ledgerGridImportAvgKwh
      : typeof eigenverbrauchMitSpeicher === "number" &&
          Number.isFinite(eigenverbrauchMitSpeicher) &&
          Number.isFinite(totalConsumption)
        ? totalConsumption - eigenverbrauchMitSpeicher
        : null;

  const einspeisungRechnerischKwhYear =
    typeof ledgerGridExportAvgKwh === "number" &&
    Number.isFinite(ledgerGridExportAvgKwh)
      ? ledgerGridExportAvgKwh
      : typeof pvYieldKwhAnnual === "number" &&
          Number.isFinite(pvYieldKwhAnnual) &&
          typeof eigenverbrauchMitSpeicher === "number" &&
          Number.isFinite(eigenverbrauchMitSpeicher)
        ? pvYieldKwhAnnual - eigenverbrauchMitSpeicher
        : null;

  const eigenverbrauchsquoteMitSpeicherPct =
    typeof pvYieldKwhAnnual === "number" &&
    pvYieldKwhAnnual > 0 &&
    typeof eigenverbrauchMitSpeicher === "number" &&
    Number.isFinite(eigenverbrauchMitSpeicher)
      ? Math.round((eigenverbrauchMitSpeicher / pvYieldKwhAnnual) * 100)
      : null;

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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-200">
                            Dachausrichtung (°) *
                          </label>
                          <select
                            value={surface.azimuthDeg}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const n = parseInt(raw, 10);
                              if (!Number.isFinite(n)) return;
                              updateSurface(planeIndex, { azimuthDeg: n });
                            }}
                            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-slate-100 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-colors"
                          >
                            {!isPresetAzimuth(surface.azimuthDeg) && (
                              <option value={surface.azimuthDeg}>
                                Individuell ({surface.azimuthDeg}°)
                              </option>
                            )}
                            <option value={0}>Nord (0°)</option>
                            <option value={45}>Nordost (45°)</option>
                            <option value={90}>Ost (90°)</option>
                            <option value={135}>Südost (135°)</option>
                            <option value={180}>Süd (180°)</option>
                            <option value={225}>Südwest (225°)</option>
                            <option value={270}>West (270°)</option>
                            <option value={315}>Nordwest (315°)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-200">
                            Exakter Azimut (°)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={359}
                            step={1}
                            value={surface.azimuthDeg}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") return;
                              const n = parseInt(raw, 10);
                              if (!Number.isFinite(n)) return;
                              updateSurface(planeIndex, {
                                azimuthDeg: Math.min(359, Math.max(0, n)),
                              });
                            }}
                            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-colors"
                          />
                          <p className="text-xs text-slate-500">
                            0° = Nord, 90° = Ost, 180° = Süd, 270° = West.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-200">
                          Dachneigung (°) *
                        </label>
                        <select
                          value={surface.tiltDeg}
                          onChange={(e) =>
                            updateSurface(planeIndex, {
                              tiltDeg: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-slate-100 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-colors"
                        >
                          <option value={0}>Flachdach (0°)</option>
                          <option value={15}>15°</option>
                          <option value={25}>25°</option>
                          <option value={30}>30°</option>
                          <option value={35}>35°</option>
                          <option value={40}>40°</option>
                          <option value={45}>45°</option>
                          <option value={60}>60° (steil)</option>
                        </select>
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
                  <div>
                    <p className="text-sm text-slate-400">
                      Empfohlene Speichergröße
                    </p>
                    <p className="text-3xl font-bold text-emerald-400 opacity-90">
                      {recommendedSize} kWh
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-xl bg-emerald-400/10 flex items-center justify-center">
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
                      <div className={SPEICHER_REPORT_KPI_ROW}>
                        <div className="min-w-0 leading-snug text-slate-400">
                          Adresse:
                        </div>
                        <div className="min-w-0 shrink-0 text-left tabular-nums font-medium text-slate-100">
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
                      Bezogen auf die PV-Erzeugung aus dem ersten Simulationsprofil und
                      Ihre empfohlene Speichergröße (Mehrjahresmittel beim
                      Eigenverbrauch mit Speicher).
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
                                    recommendedSize
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
                                    recommendedSize
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
                                    recommendedSize
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
                                    recommendedSize
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
                            Nicht im Haushaltsverbrauch, Eigenverbrauch oder
                            Autarkiegrad enthalten.
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

                <SpeicherChart data={chart.data} recommendedSize={recommendedSize} />

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
                  <p className="w-full min-w-0 text-sm leading-6 text-slate-300">
                    Wir empfehlen eine Speichergröße von{" "}
                    <span className="text-emerald-400 opacity-90 font-semibold">
                      {recommendedSize} kWh
                    </span>
                    .
                  </p>
                  {hasActiveBackupReserve && (
                    <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                      Die Berechnung berücksichtigt eine Notstromreserve von{" "}
                      {resolvedBackupReserveKwh} kWh.
                    </p>
                  )}
                  <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                    Diese Größe passt zu Ihrem Verbrauchsprofil:
                  </p>
                  <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                    Ein Teil Ihres Stromverbrauchs fällt in die Abendstunden,
                    während Ihre PV-Anlage hauptsächlich tagsüber Energie
                    erzeugt.
                  </p>
                  <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                    Der Speicher gleicht genau diese zeitliche Lücke aus und
                    erhöht so Ihren Eigenverbrauch deutlich.
                  </p>
                  <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                    Gleichzeitig zeigt die Simulation:
                  </p>
                  <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                    Ab etwa {recommendedSize} kWh nimmt der zusätzliche Nutzen
                    deutlich ab.
                  </p>
                  <div className="mt-3 w-full min-w-0 border-l border-emerald-500/30 pl-3">
                    <p className="text-emerald-300 font-medium">
                      Plateau erreicht
                    </p>
                    <p className="text-sm leading-6 text-slate-300 mt-1">
                      Ab diesem Punkt bringt zusätzlicher Speicher nur noch sehr
                      geringen Mehrwert.
                    </p>
                    <p className="text-sm leading-6 text-slate-300 mt-3">
                      Jede weitere kWh erhöht den Eigenverbrauch nur minimal
                      (unter ~1 % pro kWh).
                    </p>
                  </div>
                  <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-4">
                    👉 Das bedeutet:
                  </p>
                  <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                    Ein größerer Speicher wäre technisch möglich, würde aber kaum
                    zusätzlichen Nutzen bringen.
                  </p>
                  <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                    Diese Empfehlung basiert ausschließlich auf physikalischen
                    Zusammenhängen zwischen Erzeugung, Verbrauch und
                    Speicherverhalten.
                  </p>
                  <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                    Die Berechnung erfolgt auf Basis einer stündlichen Simulation
                    (8760 Stunden pro Jahr).
                  </p>
                  {hasActiveBackupReserve && (
                    <>
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                        Durch die aktivierte Notstromreserve steht ein Teil des
                        Speichers im Alltag nicht zur Verfügung.
                      </p>
                      <p className="w-full min-w-0 text-sm leading-6 text-slate-300 mt-3">
                        Dadurch sinken Eigenverbrauch und Autarkie leicht.
                      </p>
                    </>
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

