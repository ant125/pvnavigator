import { setImmediate } from "node:timers";
import type { AccessTier } from "@pv-access/core";

import { runHouseholdCalculation } from "@/app/(speicher)/calculate/runHouseholdCalculation";
import type { CalculationProgressEvent } from "@/lib/calculationProgress";
import {
  ACCESS_UNAVAILABLE_MESSAGE,
  calculationAddress,
  checkCalculationAccess,
  loadPinnedFreeAddress,
} from "@/lib/calculationAccess";
import { SERVICE_UNAVAILABLE_CODE } from "@/app/(speicher)/calculate/calculationNotice";
import {
  CALCULATION_RATE_LIMIT_MESSAGE,
  parseCalculationSlot,
} from "@/lib/calculationGuard";
import { persistCompletedCalculation } from "@/lib/persistCompletedCalculation";
import { withValidatedAnnualConsumption } from "@/app/(speicher)/utils/annualConsumption";

import { getServerUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UNAUTHENTICATED_MESSAGE =
  "Bitte melden Sie sich an, um die Berechnung zu starten.";

type StreamMessage =
  | { type: "progress"; event: CalculationProgressEvent }
  | {
      type: "complete";
      payload: unknown;
      calculationId: string | null;
      accessTier: AccessTier | null;
    }
  | {
      type: "error";
      message: string;
      /** Access reason or SERVICE_UNAVAILABLE_CODE; absent for calculation errors. */
      code?: string;
      freeAddress?: {
        label: string;
        street: string;
        houseNumber: string;
        postalCode: string;
        city: string;
      } | null;
      addressLimit?: number | null;
    };

export async function POST(request: Request): Promise<Response> {
  const user = await getServerUser();
  if (!user) {
    return Response.json({ message: UNAUTHENTICATED_MESSAGE }, { status: 401 });
  }

  let params: unknown;
  try {
    params = await request.json();
  } catch {
    return Response.json(
      { message: "Ungültige Anfrage." },
      { status: 400 }
    );
  }

  let input: Parameters<typeof runHouseholdCalculation>[0];
  try {
    input = withValidatedAnnualConsumption(
      params as Parameters<typeof runHouseholdCalculation>[0]
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Ungültige Anfrage.",
      },
      { status: 400 }
    );
  }

  // Access decision on the server, from the entered address only. A refused
  // address fails here, before any physics run; nothing is pinned or counted.
  const address = calculationAddress(input);
  const supabase = await createServerSupabaseClient();
  const access = await checkCalculationAccess(supabase, address);
  if (access.status === "unavailable") {
    return Response.json(
      { message: access.message, code: SERVICE_UNAVAILABLE_CODE },
      { status: 503 }
    );
  }
  if (access.status === "denied") {
    const freeAddress =
      access.decision.reason === "free_address_mismatch"
        ? await loadPinnedFreeAddress(supabase as never)
        : null;
    return Response.json(
      {
        message: access.message,
        code: access.decision.reason,
        freeAddress,
        addressLimit: access.decision.subscription?.addressLimit ?? null,
      },
      { status: 403 }
    );
  }

  const slotResult = await supabase.rpc("acquire_calculation_run");
  if (slotResult.error) {
    console.error("acquire_calculation_run failed");
    return Response.json(
      { message: ACCESS_UNAVAILABLE_MESSAGE, code: SERVICE_UNAVAILABLE_CODE },
      { status: 503 },
    );
  }
  const slot = parseCalculationSlot(slotResult.data);
  if (slot.status === "unauthenticated") {
    return Response.json({ message: UNAUTHENTICATED_MESSAGE }, { status: 401 });
  }
  if (slot.status === "limited") {
    return Response.json(
      { message: CALCULATION_RATE_LIMIT_MESSAGE, code: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(slot.retryAfterSeconds) },
      },
    );
  }
  if (slot.status !== "acquired") {
    return Response.json(
      { message: ACCESS_UNAVAILABLE_MESSAGE, code: SERVICE_UNAVAILABLE_CODE },
      { status: 503 },
    );
  }
  const releaseSlot = () => {
    void supabase.rpc("release_calculation_run", { p_id: slot.id }).then(({ error }) => {
      if (error) console.error("release_calculation_run failed");
    });
  };

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

      void runHouseholdCalculation(input, async (event) => {
        send({ type: "progress", event });
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });
      })
        .then(async (payload) => {
          // Only a successful run reaches the record step; a failed run never
          // pins the free address or consumes a subscription address.
          const recorded = await persistCompletedCalculation({
            userId: user.id,
            input,
            payload,
            address,
          });
          if (recorded.status === "denied") {
            // A parallel request settled the decision first (e.g. pinned a
            // different free address). The result is withheld, like the
            // pre-check would have done.
            const freeAddress =
              recorded.reason === "free_address_mismatch"
                ? await loadPinnedFreeAddress(supabase as never)
                : null;
            send({
              type: "error",
              message: recorded.message,
              code: recorded.reason,
              freeAddress,
              addressLimit: recorded.addressLimit,
            });
            return;
          }
          if (recorded.status === "failed") {
            // The record step (and with it the access accounting) did not
            // run. Withholding the result keeps the rules enforceable even
            // while the database function is unavailable.
            send({
              type: "error",
              message: ACCESS_UNAVAILABLE_MESSAGE,
              code: SERVICE_UNAVAILABLE_CODE,
            });
            return;
          }
          send({
            type: "complete",
            payload,
            calculationId: recorded.calculationId,
            accessTier: recorded.tier,
          });
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
          releaseSlot();
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
