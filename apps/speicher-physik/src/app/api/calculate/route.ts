import { setImmediate } from "node:timers";
import { runHouseholdCalculation } from "@/app/(speicher)/calculate/runHouseholdCalculation";
import type { CalculationProgressEvent } from "@/lib/calculationProgress";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StreamMessage =
  | { type: "progress"; event: CalculationProgressEvent }
  | { type: "complete"; payload: unknown }
  | { type: "error"; message: string };

export async function POST(request: Request): Promise<Response> {
  let params: unknown;
  try {
    params = await request.json();
  } catch {
    return Response.json(
      { message: "Ungültige Anfrage." },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (message: StreamMessage) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
        );
      };

      controller.enqueue(encoder.encode(": connected\n\n"));
      const ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 1000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        controller.close();
      };

      void runHouseholdCalculation(
        params as Parameters<typeof runHouseholdCalculation>[0],
        async (event) => {
          send({ type: "progress", event });
          await new Promise<void>((resolve) => {
            setImmediate(resolve);
          });
        }
      )
        .then((payload) => {
          send({ type: "complete", payload });
        })
        .catch((error: unknown) => {
          send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Die Berechnung ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
          });
        })
        .finally(() => {
          close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
