"use client";

import type { EvCalculationMeta } from "@/load/resolveEvLoadComponent";
import {
  EV_REPORT_COPY,
  deriveEvReportView,
  formatEvKwh,
} from "@/lib/evReportPresentation";

const GROUP_HEADING =
  "text-xs font-semibold uppercase tracking-wide text-ink";
const DATA_GRID = "grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3";
const DATA_ITEM = "border-t border-line-soft pt-3";
const DATA_LABEL = "text-xs leading-snug text-ink-muted";
const DATA_VALUE = "mt-1 text-sm font-medium tabular-nums text-ink";
const HELP = "text-xs leading-relaxed text-ink-muted";
const BAND =
  "mt-6 rounded-md border border-line-soft bg-surface-muted p-5 lg:p-6";

export function EvResultSection({ ev }: { ev: EvCalculationMeta }) {
  const view = deriveEvReportView(ev);

  return (
    <div className="mt-8 border-t border-line-soft pt-8">
      <h3 className={GROUP_HEADING}>{EV_REPORT_COPY.heading}</h3>
      <dl className={`${DATA_GRID} mt-5`}>
        {view.inputRows.map((row) => (
          <div key={row.label} className={DATA_ITEM}>
            <dt className={DATA_LABEL}>{row.label}</dt>
            <dd className={DATA_VALUE}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className={`mt-5 ${HELP}`}>{EV_REPORT_COPY.basedOnInputs}</p>
      <p className={`mt-2 ${HELP}`}>{EV_REPORT_COPY.sizeMayChange}</p>

      <div className={BAND}>
        <h4 className={GROUP_HEADING}>{EV_REPORT_COPY.derivedHeading}</h4>
        <dl className="mt-4 divide-y divide-line-soft border-y border-line-soft">
          {view.derivedRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 py-3"
            >
              <dt className="min-w-0 text-sm leading-snug text-ink-secondary">
                {row.label}
              </dt>
              <dd className="shrink-0 text-right text-sm font-medium tabular-nums text-ink">
                {formatEvKwh(row.valueKwh)}
              </dd>
            </div>
          ))}
        </dl>
        {view.workplaceRejectedKwh > 0 && (
          <p className={`mt-4 ${HELP}`}>
            {EV_REPORT_COPY.workplaceRejected}{" "}
            {formatEvKwh(view.workplaceRejectedKwh)}.
          </p>
        )}
      </div>
    </div>
  );
}
