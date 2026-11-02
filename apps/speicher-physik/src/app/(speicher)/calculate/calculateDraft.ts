import type { SpeicherInput } from "../types/speicher";

const STORAGE_KEY = "pvn.speicher.calculateDraft.v1";

export type CalculateDraft = {
  formData: Partial<SpeicherInput>;
  kwpInputStrings: string[];
  azimuthInputStrings: string[];
  tiltInputStrings: string[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function reviveSurfaces(formData: Partial<SpeicherInput>): Partial<SpeicherInput> {
  if (!formData.pvSurfaces) return formData;
  return {
    ...formData,
    pvSurfaces: formData.pvSurfaces.map((surface) => ({
      ...surface,
      systemSizeKwP:
        typeof surface.systemSizeKwP === "number" && Number.isFinite(surface.systemSizeKwP)
          ? surface.systemSizeKwP
          : Number.NaN,
    })),
  };
}

/** Draft stays in this browser, never in the URL. */
export function readCalculateDraft(): CalculateDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (!record.formData || typeof record.formData !== "object" || Array.isArray(record.formData)) {
      return null;
    }
    if (
      !isStringArray(record.kwpInputStrings) ||
      !isStringArray(record.azimuthInputStrings) ||
      !isStringArray(record.tiltInputStrings)
    ) {
      return null;
    }
    return {
      formData: reviveSurfaces(record.formData as Partial<SpeicherInput>),
      kwpInputStrings: record.kwpInputStrings,
      azimuthInputStrings: record.azimuthInputStrings,
      tiltInputStrings: record.tiltInputStrings,
    };
  } catch {
    return null;
  }
}

export function writeCalculateDraft(draft: CalculateDraft): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(draft, (_key, value: unknown) =>
      typeof value === "number" && !Number.isFinite(value) ? null : value,
    );
    window.localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* A full or blocked store must not stop the form. */
  }
}

export function clearCalculateDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
