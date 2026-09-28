import { isPvNavigatorUuid } from "@pv-auth/session";

import {
  resolveHistoricalSpeicherReport,
  type CalculationHistoryRow,
} from "@/lib/historicalSpeicherReport";

export type CalculationPdfRow = CalculationHistoryRow & {
  user_id: string;
};

export type PdfAccessDecision =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "incompatible" }
  | { status: "ok"; row: CalculationPdfRow };

/**
 * Own report only. A foreign id and a missing id share the same not_found
 * result, so the response does not reveal whether the row exists.
 */
export function decidePdfAccess(args: {
  userId: string | null;
  requestedId: string;
  row: CalculationPdfRow | null;
}): PdfAccessDecision {
  if (!args.userId) return { status: "unauthenticated" };
  if (!isPvNavigatorUuid(args.requestedId) || !args.row) {
    return { status: "not_found" };
  }
  if (args.row.user_id !== args.userId) return { status: "not_found" };
  if (args.row.id !== args.requestedId) return { status: "not_found" };

  const outcome = resolveHistoricalSpeicherReport({
    requestedId: args.requestedId,
    row: args.row,
  });
  if (outcome.status === "not_found") return { status: "not_found" };
  if (outcome.status === "incompatible") return { status: "incompatible" };
  return { status: "ok", row: args.row };
}

export const PDF_UNAUTHENTICATED_MESSAGE =
  "Bitte melden Sie sich an, um das PDF herunterzuladen.";
export const PDF_NOT_FOUND_MESSAGE = "Dieser Bericht ist nicht verfügbar.";
export const PDF_INCOMPATIBLE_MESSAGE =
  "Dieser gespeicherte Bericht kann mit der aktuellen Version nicht als PDF erstellt werden.";
export const PDF_GENERATION_ERROR_MESSAGE =
  "Das PDF konnte nicht erstellt werden. Bitte versuchen Sie es erneut.";

export function pdfFailureResponse(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof Error && error.name === "PdfSourceError") {
    return { status: 422, message: PDF_INCOMPATIBLE_MESSAGE };
  }
  return { status: 500, message: PDF_GENERATION_ERROR_MESSAGE };
}
