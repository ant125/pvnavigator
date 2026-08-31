"use client";

import type { CalculationProgressState } from "@/lib/calculationProgress";
import {
  SMART_METER_HOUSEHOLD_COUNT,
  getCalculationProgressStages,
  isCalculationStageDone,
} from "@/lib/calculationProgress";

const STAGE_5_LABEL = "Validierung mit realen Referenzhaushalten";

/** Matches DEFAULT_MULTI_YEAR_YEARS (2006–2020). Presentation only. */
const WEATHER_YEAR_COUNT = 15;

function formatElapsed(seconds: number): string {
  return seconds === 1 ? "1 Sekunde" : `${seconds} Sekunden`;
}

function StageMark({
  state,
}: {
  state: "done" | "active" | "pending";
}) {
  if (state === "done") {
    return (
      <span className="text-success" aria-hidden>
        ✓
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent"
        aria-hidden
      />
    );
  }
  return <span className="inline-block h-3.5 w-3.5" aria-hidden />;
}

type CalculationProgressListProps = {
  progress: CalculationProgressState;
  elapsedSeconds: number;
  complete?: boolean;
  /** Luft/Wasser only. Presentation row; no extra backend event. */
  includeHeatPumpProfile?: boolean;
};

export function CalculationProgressList({
  progress,
  elapsedSeconds,
  complete = false,
  includeHeatPumpProfile = false,
}: CalculationProgressListProps) {
  const stages = getCalculationProgressStages(includeHeatPumpProfile);
  const stage5Active = progress.physics && !complete;
  const showValidationCopy = stage5Active || complete;
  const householdTotal =
    progress.smartmeterTotal > 0
      ? progress.smartmeterTotal
      : SMART_METER_HOUSEHOLD_COUNT;
  const householdCompleted = complete
    ? householdTotal
    : progress.smartmeterCompleted;
  const counterLine = `${householdCompleted} von ${householdTotal} Referenzhaushalten geprüft`;

  return (
    <section
      aria-label="Berechnungsfortschritt"
      aria-live="polite"
      className="w-full max-w-lg rounded-lg border border-line bg-surface px-5 py-6 sm:px-7 sm:py-7"
    >
      <header className="flex items-start justify-between gap-6 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            {complete ? (
              <span className="text-sm text-success" aria-hidden>
                ✓
              </span>
            ) : (
              <span
                className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent"
                aria-hidden
              />
            )}
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {complete ? "Berechnung abgeschlossen." : "Berechnung läuft"}
          </h2>
        </div>
        <p className="shrink-0 text-right leading-snug">
          <span className="block text-xs text-ink-muted">Berechnungszeit</span>
          <span className="mt-0.5 block text-sm tabular-nums text-ink-secondary">
            {formatElapsed(elapsedSeconds)}
          </span>
        </p>
      </header>

      <ol className="list-none border-t border-line-soft pt-4">
        {stages.map((stage, index) => {
          const done = isCalculationStageDone(stage.id, progress, complete);
          const previousDone =
            index === 0
              ? true
              : isCalculationStageDone(
                  stages[index - 1].id,
                  progress,
                  complete
                );
          const active = !done && previousDone;
          const state = done ? "done" : active ? "active" : "pending";

          return (
            <li
              key={stage.id}
              className={`flex items-start gap-3 py-1 text-sm leading-snug ${
                state === "done"
                  ? "text-success"
                  : state === "active"
                    ? "font-medium text-ink"
                    : "text-ink-muted"
              }`}
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                <StageMark state={state} />
              </span>
              <span>{done ? stage.done : stage.active}</span>
            </li>
          );
        })}

        <li
          className={`flex items-start gap-3 py-1 text-sm leading-snug ${
            complete
              ? "text-success"
              : stage5Active
                ? "font-medium text-ink"
                : "text-ink-muted"
          }`}
        >
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
            <StageMark
              state={complete ? "done" : stage5Active ? "active" : "pending"}
            />
          </span>
          <span>
            {STAGE_5_LABEL}
            <span
              className={`mt-0.5 block text-xs font-normal tabular-nums text-ink-secondary ${
                stage5Active || complete ? "" : "invisible"
              }`}
            >
              {stage5Active || complete
                ? counterLine
                : `${householdTotal} von ${householdTotal} Referenzhaushalten geprüft`}
            </span>
          </span>
        </li>
      </ol>

      <div className="mt-5 space-y-3">
        <div className="grid text-sm leading-relaxed text-ink-secondary">
          <p
            className={`col-start-1 row-start-1 ${
              showValidationCopy ? "invisible" : ""
            }`}
          >
            Die Berechnung basiert auf einem physikalischen Simulationsmodell.
            Im Anschluss wird das Ergebnis mit realen Haushaltsprofilen geprüft.
          </p>
          <p
            className={`col-start-1 row-start-1 ${
              complete
                ? "invisible"
                : showValidationCopy
                  ? ""
                  : "invisible"
            }`}
          >
            Empfehlung bereits berechnet. Jetzt wird geprüft, wie stabil das
            Ergebnis bei realen Haushaltsprofilen bleibt.
          </p>
          <p
            className={`col-start-1 row-start-1 ${complete ? "" : "invisible"}`}
          >
            Die Empfehlung wurde mit {householdTotal} realen Haushaltsprofilen
            geprüft.
          </p>
        </div>
        <p className="text-[11px] leading-relaxed tracking-wide text-ink-muted/70">
          {WEATHER_YEAR_COUNT} Wetterjahre · physikalische Batteriesimulation ·{" "}
          {SMART_METER_HOUSEHOLD_COUNT} Referenzhaushalte
        </p>
      </div>
    </section>
  );
}
