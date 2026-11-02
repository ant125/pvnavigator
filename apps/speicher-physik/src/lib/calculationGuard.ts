export const CALCULATION_RATE_LIMIT_MESSAGE =
  "Es laufen gerade zu viele Berechnungen. Bitte versuchen Sie es in einigen Minuten erneut.";

export type CalculationSlot =
  | { status: "acquired"; id: string }
  | { status: "limited"; retryAfterSeconds: number }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

/** Reads the JSON from acquire_calculation_run. The limits live in the database. */
export function parseCalculationSlot(value: unknown): CalculationSlot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "unavailable" };
  }
  const record = value as Record<string, unknown>;
  if (record.ok === true && typeof record.id === "string" && record.id.trim()) {
    return { status: "acquired", id: record.id.trim() };
  }
  if (record.ok === false && record.reason === "unauthenticated") {
    return { status: "unauthenticated" };
  }
  if (record.ok === false) {
    const retry =
      typeof record.retry_after_seconds === "number" && Number.isFinite(record.retry_after_seconds)
        ? Math.max(1, Math.ceil(record.retry_after_seconds))
        : 60;
    return { status: "limited", retryAfterSeconds: retry };
  }
  return { status: "unavailable" };
}
