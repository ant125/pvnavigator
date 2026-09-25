"use client";

import type { ReactNode } from "react";
import { formatCalculationDurationDe } from "@/lib/calculationProgress";
import { suppressPointerFocus } from "./formStyles";

const ANLAGE_PANEL_ID = "anlage-eingaben";

export function CompletedCalculationRow({
  durationMs,
  anlageOpen,
  onToggleAnlage,
  chips,
}: {
  durationMs: number | null;
  anlageOpen: boolean;
  onToggleAnlage: () => void;
  chips?: ReactNode;
}) {
  const durationLabel =
    durationMs !== null
      ? `${formatCalculationDurationDe(durationMs)}\u00A0s`
      : null;

  return (
    <div className="sg-completed-bar border-b border-line bg-accent-soft px-3 py-2">
      <p className="sg-completed-main text-sm text-ink">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] text-white"
          aria-hidden
        >
          ✓
        </span>
        <span className="font-semibold">Berechnung abgeschlossen</span>
        {durationLabel ? (
          <span className="font-mono text-xs tabular-nums text-ink-secondary">
            {durationLabel}
          </span>
        ) : null}
      </p>
      {chips}
      <div className="sg-completed-actions ml-auto">
        <button
          type="button"
          onMouseDown={suppressPointerFocus}
          onClick={onToggleAnlage}
          aria-expanded={anlageOpen}
          aria-controls={ANLAGE_PANEL_ID}
          className="bg-transparent font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-accent-text hover:bg-accent-soft hover:text-accent-hover"
        >
          {anlageOpen ? "Anlage & Eingaben −" : "Anlage & Eingaben +"}
        </button>
      </div>
    </div>
  );
}
