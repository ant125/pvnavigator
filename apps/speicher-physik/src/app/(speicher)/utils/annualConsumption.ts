/**
 * Shared Hausverbrauch (annual household kWh) validation.
 * Used by the calculate form and by the server orchestrator so the rules
 * cannot drift. No calculation physics.
 */

export const ANNUAL_CONSUMPTION_KWH_MIN = 500;
export const ANNUAL_CONSUMPTION_KWH_MAX = 50000;

export const GERMAN_POSTAL_CODE_PATTERN = /^\d{5}$/;

export const ANNUAL_CONSUMPTION_RANGE_MESSAGE =
  "Der Jahresstromverbrauch muss zwischen 500 und 50.000 kWh liegen.";

export const ANNUAL_CONSUMPTION_INTEGER_MESSAGE =
  "Der Jahresstromverbrauch muss als ganze Zahl in kWh angegeben werden.";

export const ANNUAL_CONSUMPTION_POSTAL_CODE_MESSAGE =
  "Der Jahresstromverbrauch entspricht Ihrer Postleitzahl. Bitte prüfen Sie die Eingabe.";

export type AnnualConsumptionIssue =
  | "missing"
  | "malformed"
  | "not_integer"
  | "out_of_range"
  | "matches_postal_code";

export type AnnualConsumptionValidation =
  | { ok: true; value: number }
  | { ok: false; code: AnnualConsumptionIssue; message: string };

function isGermanPostalCode(value: unknown): value is string {
  return typeof value === "string" && GERMAN_POSTAL_CODE_PATTERN.test(value.trim());
}

/**
 * Detect stored rows where Hausverbrauch was filled with the PLZ.
 * Does not delete or rewrite anything. Safe for historical snapshots.
 */
export function isPostalCodeAsAnnualConsumption(input: {
  annualConsumptionKWh: unknown;
  postalCode: unknown;
}): boolean {
  if (!isGermanPostalCode(input.postalCode)) return false;
  const plz = input.postalCode.trim();
  const consumption =
    typeof input.annualConsumptionKWh === "number"
      ? input.annualConsumptionKWh
      : typeof input.annualConsumptionKWh === "string" &&
          input.annualConsumptionKWh.trim() !== ""
        ? Number(input.annualConsumptionKWh)
        : Number.NaN;
  return Number.isInteger(consumption) && consumption === Number(plz);
}

/**
 * Parse a Hausverbrauch value without silent truncation.
 *
 * - Empty → undefined
 * - A single German decimal comma is normalized to a period ("4500,0" → 4500)
 * - Mixed "," and "." or multiple separators → NaN
 * - Decimals such as 4500.5 / 4500,5 are returned as-is (not truncated);
 *   {@link validateAnnualConsumption} then rejects non-integers
 */
export function parseAnnualConsumptionInput(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "number") return raw;
  if (typeof raw === "boolean" || typeof raw === "object") return Number.NaN;
  if (typeof raw !== "string") return Number.NaN;

  const s = raw.trim().replace(/ /g, "");
  if (s === "") return undefined;

  const commaCount = (s.match(/,/g) ?? []).length;
  const dotCount = (s.match(/\./g) ?? []).length;
  if (commaCount > 1 || dotCount > 1 || (commaCount >= 1 && dotCount >= 1)) {
    return Number.NaN;
  }

  const normalized = commaCount === 1 ? s.replace(",", ".") : s;
  if (!/^[+-]?\d+(\.\d*)?$/.test(normalized)) return Number.NaN;

  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function validateAnnualConsumption(params: {
  annualConsumptionKwh: unknown;
  postalCode?: unknown;
}): AnnualConsumptionValidation {
  const parsed = parseAnnualConsumptionInput(params.annualConsumptionKwh);

  if (parsed === undefined) {
    return {
      ok: false,
      code: "missing",
      message: ANNUAL_CONSUMPTION_RANGE_MESSAGE,
    };
  }

  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    return {
      ok: false,
      code: "malformed",
      message: ANNUAL_CONSUMPTION_RANGE_MESSAGE,
    };
  }

  if (!Number.isInteger(parsed)) {
    return {
      ok: false,
      code: "not_integer",
      message: ANNUAL_CONSUMPTION_INTEGER_MESSAGE,
    };
  }

  if (
    isPostalCodeAsAnnualConsumption({
      annualConsumptionKWh: parsed,
      postalCode: params.postalCode,
    })
  ) {
    return {
      ok: false,
      code: "matches_postal_code",
      message: ANNUAL_CONSUMPTION_POSTAL_CODE_MESSAGE,
    };
  }

  if (
    parsed < ANNUAL_CONSUMPTION_KWH_MIN ||
    parsed > ANNUAL_CONSUMPTION_KWH_MAX
  ) {
    return {
      ok: false,
      code: "out_of_range",
      message: ANNUAL_CONSUMPTION_RANGE_MESSAGE,
    };
  }

  return { ok: true, value: parsed };
}

/** Throws a user-facing German Error. Call before PVGIS / load / kernel. */
export function assertValidAnnualConsumption(params: {
  annualConsumptionKwh: unknown;
  postalCode?: unknown;
}): number {
  const result = validateAnnualConsumption(params);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

export function withValidatedAnnualConsumption<
  T extends { annualConsumptionKWh?: unknown; postalCode?: unknown },
>(params: T): T & { annualConsumptionKWh: number } {
  const annualConsumptionKWh = assertValidAnnualConsumption({
    annualConsumptionKwh: params.annualConsumptionKWh,
    postalCode: params.postalCode,
  });
  return { ...params, annualConsumptionKWh };
}
