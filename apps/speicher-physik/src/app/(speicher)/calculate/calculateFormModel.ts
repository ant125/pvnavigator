import type { PvSurfaceInput, SpeicherInput } from "../types/speicher";

export const DEFAULT_SURFACE: PvSurfaceInput = {
  systemSizeKwP: NaN,
  tiltDeg: 30,
  azimuthDeg: 180,
};

export const INITIAL_FORM_DATA: Partial<SpeicherInput> = {
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
};

export const AZIMUTH_PRESET_DEGREES = [
  0, 45, 90, 135, 180, 225, 270, 315,
] as const;

export type AzimuthPreset = (typeof AZIMUTH_PRESET_DEGREES)[number];

export const TILT_PRESET_DEGREES = [0, 15, 25, 30, 35, 40, 45, 60] as const;

export type PresetDropdownOption = {
  value: number | string;
  label: string;
};

export const AZIMUTH_PRESET_OPTIONS: PresetDropdownOption[] = [
  { value: 0, label: "Nord (0°)" },
  { value: 45, label: "Nordost (45°)" },
  { value: 90, label: "Ost (90°)" },
  { value: 135, label: "Südost (135°)" },
  { value: 180, label: "Süd (180°)" },
  { value: 225, label: "Südwest (225°)" },
  { value: 270, label: "West (270°)" },
  { value: 315, label: "Nordwest (315°)" },
];

export const TILT_PRESET_OPTIONS: PresetDropdownOption[] = [
  { value: 0, label: "Flachdach (0°)" },
  { value: 15, label: "15°" },
  { value: 25, label: "25°" },
  { value: 30, label: "30°" },
  { value: 35, label: "35°" },
  { value: 40, label: "40°" },
  { value: 45, label: "45°" },
  { value: 60, label: "60° (steil)" },
];

export function isPresetAzimuth(deg: number | undefined): deg is AzimuthPreset {
  return (
    deg !== undefined &&
    (AZIMUTH_PRESET_DEGREES as readonly number[]).includes(deg)
  );
}

export function isPresetTilt(deg: number | undefined): boolean {
  return (
    deg !== undefined &&
    (TILT_PRESET_DEGREES as readonly number[]).includes(deg)
  );
}

export function surfacesOrDefault(form: Partial<SpeicherInput>): PvSurfaceInput[] {
  const s = form.pvSurfaces;
  if (s && s.length > 0) return s.map((row) => ({ ...row }));
  return [{ ...DEFAULT_SURFACE }];
}

export function sumSurfaceKwP(surfaces: PvSurfaceInput[]): number {
  return surfaces.reduce(
    (acc, x) =>
      Number.isFinite(x.systemSizeKwP) ? acc + x.systemSizeKwP : acc,
    0
  );
}

export function formatKwpDisplay(n: number): string {
  if (!Number.isFinite(n)) return "";
  return parseFloat((Math.round(n * 100) / 100).toFixed(2)).toString();
}

export function formatAzimuthLabel(deg: number | undefined): string {
  if (deg === undefined || !Number.isFinite(deg)) return "—";
  const preset = AZIMUTH_PRESET_OPTIONS.find((opt) => opt.value === deg);
  return preset?.label ?? `${deg}°`;
}

export function formatTiltLabel(deg: number | undefined): string {
  if (deg === undefined || !Number.isFinite(deg)) return "—";
  const preset = TILT_PRESET_OPTIONS.find((opt) => opt.value === deg);
  return preset?.label ?? `${deg}°`;
}

export function parseKwpDecimalInput(raw: string): number {
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

export function parseAzimuthInput(raw: string): { valid: boolean; deg: number } {
  const s = raw.trim();
  if (s === "") return { valid: false, deg: NaN };
  if (!/^\d+$/.test(s)) return { valid: false, deg: NaN };
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0 || n > 359) return { valid: false, deg: NaN };
  return { valid: true, deg: n };
}

export function parseTiltInput(raw: string): { valid: boolean; deg: number } {
  const s = raw.trim();
  if (s === "") return { valid: false, deg: NaN };
  if (!/^\d+$/.test(s)) return { valid: false, deg: NaN };
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0 || n > 90) return { valid: false, deg: NaN };
  return { valid: true, deg: n };
}

export function buildAzimuthDropdownOptions(
  azimuthDeg: number
): PresetDropdownOption[] {
  if (Number.isFinite(azimuthDeg) && !isPresetAzimuth(azimuthDeg)) {
    return [
      { value: azimuthDeg, label: `Individuell (${azimuthDeg}°)` },
      ...AZIMUTH_PRESET_OPTIONS,
    ];
  }
  return AZIMUTH_PRESET_OPTIONS;
}

export function buildTiltDropdownOptions(tiltDeg: number): PresetDropdownOption[] {
  if (Number.isFinite(tiltDeg) && !isPresetTilt(tiltDeg)) {
    return [
      { value: tiltDeg, label: `Individuell (${tiltDeg}°)` },
      ...TILT_PRESET_OPTIONS,
    ];
  }
  return TILT_PRESET_OPTIONS;
}
