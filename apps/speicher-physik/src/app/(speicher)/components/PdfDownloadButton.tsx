"use client";

import { useState } from "react";

import { BTN_SECONDARY } from "@/app/(speicher)/calculate/formStyles";
import { PDF_DOWNLOAD_FILENAME } from "@/pdf/pdfDownload";

type Phase = "idle" | "loading" | "error";

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  } catch {
    /* The body is not the JSON error contract. */
  }
  return "Das PDF konnte nicht erstellt werden. Bitte versuchen Sie es erneut.";
}

export function PdfDownloadButton({
  calculationId,
}: {
  calculationId: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    if (phase === "loading") return;
    if (!calculationId) {
      setPhase("error");
      setMessage(
        "Der Bericht wurde nicht gespeichert. Das PDF kann nicht erstellt werden.",
      );
      return;
    }

    setPhase("loading");
    setMessage(null);
    try {
      const response = await fetch(`/api/calculations/${calculationId}/pdf`, {
        method: "GET",
        headers: { Accept: "application/pdf" },
      });
      if (!response.ok) {
        throw new Error(await errorMessage(response));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = PDF_DOWNLOAD_FILENAME;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setPhase("idle");
    } catch (error) {
      setPhase("error");
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "Das PDF konnte nicht erstellt werden. Bitte versuchen Sie es erneut.",
      );
    }
  }

  const label =
    phase === "loading"
      ? "PDF wird erstellt …"
      : phase === "error"
        ? "Erneut versuchen"
        : "PDF herunterladen";

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <button
        type="button"
        className={BTN_SECONDARY}
        onClick={() => {
          void download();
        }}
        disabled={phase === "loading"}
        aria-busy={phase === "loading" || undefined}
      >
        {label}
      </button>
      {phase === "error" && message ? (
        <p role="alert" className="max-w-sm text-sm leading-relaxed text-warning">
          {message}
        </p>
      ) : null}
    </div>
  );
}
