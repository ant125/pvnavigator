import type { AccessTier } from "@pv-access/core";

import type { HouseholdCalculationPayload } from "./actions";
import {
  CalculationNoticeError,
  noticeKindFromCode,
  parseAddressLimit,
  parsePinnedAddress,
  type PinnedAddressFields,
} from "./calculationNotice";
import type { CalculationProgressEvent } from "@/lib/calculationProgress";

type StreamMessage =
  | { type: "progress"; event: CalculationProgressEvent }
  | {
      type: "complete";
      payload: HouseholdCalculationPayload;
      calculationId?: string | null;
      accessTier?: AccessTier | null;
    }
  | {
      type: "error";
      message: string;
      code?: string;
      freeAddress?: PinnedAddressFields | null;
      addressLimit?: number | null;
    };

const GENERIC_FAILURE_MESSAGE =
  "Die Berechnung ist fehlgeschlagen. Bitte versuchen Sie es erneut.";

export type JsonErrorBody = {
  message: string;
  code: string | null;
  freeAddress: PinnedAddressFields | null;
  addressLimit: number | null;
};

export async function readJsonMessage(
  response: Response
): Promise<JsonErrorBody | null> {
  try {
    const body = (await response.json()) as {
      message?: unknown;
      code?: unknown;
      freeAddress?: unknown;
      addressLimit?: unknown;
    };
    if (typeof body.message === "string" && body.message.trim()) {
      return {
        message: body.message,
        code: typeof body.code === "string" ? body.code : null,
        freeAddress: parsePinnedAddress(body.freeAddress),
        addressLimit: parseAddressLimit(body.addressLimit),
      };
    }
  } catch {
    /* Not the JSON error contract. */
  }
  return null;
}

/**
 * Server refusals carry a `code`; those are shown as a notice, not as an
 * input error. Everything else stays a plain Error.
 */
function toClientError(
  message: string,
  code: string | null | undefined,
  freeAddress: PinnedAddressFields | null = null,
  addressLimit: number | null = null,
): Error {
  const kind = noticeKindFromCode(code);
  return kind
    ? new CalculationNoticeError(kind, message, code ?? null, freeAddress, addressLimit)
    : new Error(message);
}

function parseSseChunk(chunk: string): StreamMessage[] {
  const messages: StreamMessage[] = [];
  const events = chunk.split("\n\n");
  for (const event of events) {
    const dataLines = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart());
    if (dataLines.length === 0) continue;
    try {
      messages.push(JSON.parse(dataLines.join("\n")) as StreamMessage);
    } catch {
      /* ignore keep-alive comments */
    }
  }
  return messages;
}

/**
 * Runs the calculation over a server-sent event stream so the UI can
 * follow backend stages, including each finished Smart-Meter household.
 */
export async function runHouseholdCalculationStream(
  body: unknown,
  onProgress: (event: CalculationProgressEvent) => void
): Promise<{
  payload: HouseholdCalculationPayload;
  calculationId: string | null;
  /** Decided on the server when the report was saved; null if it was not saved. */
  accessTier: AccessTier | null;
}> {
  const response = await fetch("/api/calculate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    throw new Error(
      "Bitte melden Sie sich an, um die Berechnung zu starten."
    );
  }

  if (!response.ok || !response.body) {
    // 400 (invalid input), 403 (access rule), 429 (busy), 503 (access check down)
    // carry a German explanation in the JSON body.
    const body = await readJsonMessage(response);
    if (!body) throw new Error(GENERIC_FAILURE_MESSAGE);
    const code =
      body.code ?? (response.status === 503 ? "service_unavailable" : null);
    throw toClientError(body.message, code, body.freeAddress, body.addressLimit);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let payload: HouseholdCalculationPayload | null = null;
  let calculationId: string | null = null;
  let accessTier: AccessTier | null = null;
  let streamError: {
    message: string;
    code: string | null;
    freeAddress: PinnedAddressFields | null;
    addressLimit: number | null;
  } | null = null;
  const takeError = (message: Extract<StreamMessage, { type: "error" }>) => {
    streamError = {
      message: message.message,
      code: message.code ?? null,
      freeAddress: parsePinnedAddress(message.freeAddress),
      addressLimit: parseAddressLimit(message.addressLimit),
    };
  };
  const takeComplete = (message: Extract<StreamMessage, { type: "complete" }>) => {
    payload = message.payload;
    calculationId =
      typeof message.calculationId === "string" ? message.calculationId : null;
    accessTier =
      message.accessTier === "free" || message.accessTier === "paid"
        ? message.accessTier
        : null;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const message of parseSseChunk(`${part}\n\n`)) {
        if (message.type === "progress") {
          onProgress(message.event);
        } else if (message.type === "complete") {
          takeComplete(message);
        } else if (message.type === "error") {
          takeError(message);
        }
      }
    }
  }

  if (buffer.trim()) {
    for (const message of parseSseChunk(`${buffer}\n\n`)) {
      if (message.type === "progress") onProgress(message.event);
      else if (message.type === "complete") takeComplete(message);
      else if (message.type === "error") takeError(message);
    }
  }

  if (streamError) {
    const { message, code, freeAddress, addressLimit } = streamError;
    throw toClientError(message, code, freeAddress, addressLimit);
  }
  if (!payload) {
    throw new Error(GENERIC_FAILURE_MESSAGE);
  }
  return { payload, calculationId, accessTier };
}
