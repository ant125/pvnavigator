"use client";

import type { ReactNode } from "react";
import { formatCalculationDurationDe } from "@/lib/calculationProgress";

export function CompletedCalculationRow({
  durationMs,
  expanded,
  onToggle,
  children,
}: {
  durationMs: number | null;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const durationLabel =
    durationMs !== null
      ? `${formatCalculationDurationDe(durationMs)} s`
      : null;

  return (
    <div className="overflow-hidden rounded-sm border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-accent-soft px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-ink">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-white"
            aria-hidden
          >
            ✓
          </span>
          <span>
            Berechnung abgeschlossen
            {durationLabel ? (
              <span className="ml-2 font-mono tabular-nums text-ink-secondary">
                · {durationLabel}
              </span>
            ) : null}
          </span>
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent-text hover:text-accent-hover"
        >
          {expanded ? "Details −" : "Details +"}
        </button>
      </div>
      {expanded ? <div className="border-t border-line p-4">{children}</div> : null}
    </div>
  );
}
