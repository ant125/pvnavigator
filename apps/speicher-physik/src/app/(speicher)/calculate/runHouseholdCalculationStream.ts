import type { HouseholdCalculationPayload } from "./actions";
import type { CalculationProgressEvent } from "@/lib/calculationProgress";

type StreamMessage =
  | { type: "progress"; event: CalculationProgressEvent }
  | { type: "complete"; payload: HouseholdCalculationPayload }
  | { type: "error"; message: string };

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
): Promise<HouseholdCalculationPayload> {
  const response = await fetch("/api/calculate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (!response.body) {
    throw new Error(
      "Die Berechnung ist fehlgeschlagen. Bitte versuchen Sie es erneut."
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let payload: HouseholdCalculationPayload | null = null;
  let streamError: string | null = null;

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
          payload = message.payload;
        } else if (message.type === "error") {
          streamError = message.message;
        }
      }
    }
  }

  if (buffer.trim()) {
    for (const message of parseSseChunk(`${buffer}\n\n`)) {
      if (message.type === "progress") onProgress(message.event);
      else if (message.type === "complete") payload = message.payload;
      else if (message.type === "error") streamError = message.message;
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }
  if (!payload) {
    throw new Error(
      "Die Berechnung ist fehlgeschlagen. Bitte versuchen Sie es erneut."
    );
  }
  return payload;
}
