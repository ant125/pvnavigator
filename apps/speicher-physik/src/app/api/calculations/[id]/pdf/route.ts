import { getServerUser } from "@/lib/auth";
import { HISTORICAL_SPEICHER_REPORT_SELECT } from "@/lib/historicalSpeicherReport";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { buildSpeicherPdfModel } from "@/pdf/buildDisplayModel";
import {
  PDF_INCOMPATIBLE_MESSAGE,
  PDF_NOT_FOUND_MESSAGE,
  PDF_UNAUTHENTICATED_MESSAGE,
  decidePdfAccess,
  pdfFailureResponse,
  type CalculationPdfRow,
} from "@/pdf/pdfAccess";
import { PDF_DOWNLOAD_FILENAME } from "@/pdf/pdfDownload";
import { renderSpeicherPdf } from "@/pdf/renderSpeicherPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PDF_SELECT = `${HISTORICAL_SPEICHER_REPORT_SELECT}, user_id`;

function jsonMessage(message: string, status: number): Response {
  return Response.json({ message }, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const user = await getServerUser();

  let row: CalculationPdfRow | null = null;
  if (user) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("calculations")
      .select(PDF_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("Failed to load calculation for PDF", error);
    }
    row = (data as CalculationPdfRow | null) ?? null;
  }

  const decision = decidePdfAccess({
    userId: user?.id ?? null,
    requestedId: id,
    row,
  });

  if (decision.status === "unauthenticated") {
    return jsonMessage(PDF_UNAUTHENTICATED_MESSAGE, 401);
  }
  if (decision.status === "not_found") {
    return jsonMessage(PDF_NOT_FOUND_MESSAGE, 404);
  }
  if (decision.status === "incompatible") {
    return jsonMessage(PDF_INCOMPATIBLE_MESSAGE, 422);
  }

  try {
    const model = buildSpeicherPdfModel(decision.row);
    const pdf = await renderSpeicherPdf(model);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${PDF_DOWNLOAD_FILENAME}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const failure = pdfFailureResponse(error);
    if (failure.status !== 422) {
      console.error("Failed to render SpeicherGrenze PDF", error);
    }
    return jsonMessage(failure.message, failure.status);
  }
}
