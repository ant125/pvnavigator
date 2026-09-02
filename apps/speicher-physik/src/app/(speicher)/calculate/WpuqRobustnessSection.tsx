"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import type { WpuqRobustnessPayload } from "@/lib/wpuqRobustnessStats";
import type { WwRobustnessPayload } from "@/lib/wpuqWwRobustnessStats";
import {
  BDEW_STANDARDPROFIL_HINT,
  WW_HEAT_PUMP_DIFFER_EXPLANATION,
  WW_ROBUSTNESS_QUESTION,
  anonymizedProfileLabel,
  formatOptionalReportKwh,
  formatOptionalReportPct,
  formatReportKwh,
  formatReportPct,
  formatReportRangeKwh,
  formatReportRangePct,
  householdRobustnessConclusion,
  householdRobustnessExplanation,
  shouldShowWwRobustnessSection,
  wwRobustnessConclusion,
  wwRobustnessExplanation,
} from "@/lib/robustnessReportCopy";
import {
  getReportMethodologySources,
  type ReportHeatPumpCitation,
} from "@/lib/reportMethodologySources";

type BdewReportValues = {
  technicalSpeichergrenzeKwh: number | null;
  eigenverbrauchsquotePct: number | null;
  autarkiePct: number | null;
};

type WpuqRobustnessSectionProps = {
  robustness: WpuqRobustnessPayload;
  wasserWasserRobustness?: WwRobustnessPayload | null;
  bdew: BdewReportValues;
};

function InfoHint({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  const tooltipId = useId();

  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-muted/80 transition-colors hover:text-ink-secondary focus-visible:text-ink-secondary"
        aria-label={label}
        aria-describedby={tooltipId}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-full z-20 mt-2 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-md border border-tooltip-border bg-tooltip-bg px-3 py-2 text-left text-xs font-normal leading-relaxed text-tooltip-ink opacity-0 shadow-sm transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}

type CompareRow = {
  label: string;
  primary: string;
  range: string;
};

function RobustnessCompareTable({
  caption,
  primaryLabel,
  rangeLabel,
  rows,
}: {
  caption: string;
  primaryLabel: string;
  rangeLabel: string;
  rows: readonly CompareRow[];
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            <th
              scope="col"
              className="bg-surface-muted px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-ink"
            >
              Kennwert
            </th>
            <th
              scope="col"
              className="bg-surface-muted px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-ink"
            >
              {primaryLabel}
            </th>
            <th
              scope="col"
              className="bg-surface-muted px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-ink-secondary"
            >
              {rangeLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line-soft">
              <th
                scope="row"
                className="px-3 py-2.5 text-left font-medium text-ink"
              >
                {row.label}
              </th>
              <td className="px-3 py-2.5 text-base font-semibold tabular-nums text-ink">
                {row.primary}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-ink-secondary">
                {row.range}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailsToggle({
  open,
  onToggle,
  closedLabel,
  openLabel,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  closedLabel: string;
  openLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6">
      <button
        type="button"
        className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
        aria-expanded={open}
        onClick={onToggle}
      >
        {open ? openLabel : closedLabel}
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function ReportQuellenSection({
  heatPump,
}: {
  heatPump?: ReportHeatPumpCitation;
}) {
  const sources = getReportMethodologySources(heatPump);

  return (
    <section
      aria-labelledby="report-quellen-heading"
      className="mt-8 border-t border-line pt-8 lg:mt-10 lg:pt-10"
    >
      <h2
        id="report-quellen-heading"
        className="text-lg font-semibold text-ink"
      >
        Quellen & wissenschaftliche Grundlagen
      </h2>
      <p className="mt-3 max-w-reading text-sm leading-relaxed text-ink-secondary">
        Die ausführliche Dokumentation steht unter{" "}
        <Link
          href="/methodik-quellen"
          className="font-medium text-accent transition-colors hover:text-accent-hover"
        >
          Methodik
        </Link>
        . Hier nur die Quellen, die dieser Bericht verwendet.
      </p>
      <ul className="mt-5 max-w-reading space-y-4">
        {sources.map((source) => (
          <li key={source.id}>
            <p className="text-sm font-medium text-ink">{source.title}</p>
            {source.detail ? (
              <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                {source.detail}
              </p>
            ) : null}
            {source.organization ? (
              <p
                className={
                  source.detail
                    ? "mt-1 text-xs text-ink-muted"
                    : "text-xs text-ink-muted"
                }
              >
                {source.organization}
              </p>
            ) : null}
            {source.url && source.linkLabel ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              >
                {source.linkLabel} ↗
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function HouseholdRobustnessBlock({
  robustness,
  bdew,
}: {
  robustness: WpuqRobustnessPayload;
  bdew: BdewReportValues;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const n = robustness.cohortSize;
  const technicalPrimary =
    typeof bdew.technicalSpeichergrenzeKwh === "number"
      ? bdew.technicalSpeichergrenzeKwh
      : robustness.bdewTechnicalSizeKwh;

  return (
    <section
      aria-labelledby="household-robustness-heading"
      className="mt-8 border-t border-line pt-8 lg:mt-10 lg:pt-10"
    >
      <h2
        id="household-robustness-heading"
        className="max-w-reading text-lg font-semibold leading-snug text-ink"
      >
        Was ändert sich, wenn Ihr Haushalt Strom anders verbraucht als das{" "}
        <span className="whitespace-nowrap">
          BDEW-Standardprofil
          <InfoHint label="Was ist das BDEW-Standardprofil?">
            {BDEW_STANDARDPROFIL_HINT}
          </InfoHint>
        </span>
        ?
      </h2>

      <div className="mt-4 max-w-reading space-y-5 text-sm leading-relaxed text-ink-secondary">
        {householdRobustnessExplanation(n).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <RobustnessCompareTable
        caption={`Hauptrechnung BDEW H25 im Vergleich mit ${n} realen Haushaltsprofilen`}
        primaryLabel="Hauptrechnung · BDEW H25"
        rangeLabel={`${n} reale Haushaltsprofile`}
        rows={[
          {
            label: "Technische Speichergrenze",
            primary: formatOptionalReportKwh(technicalPrimary),
            range: formatReportRangeKwh(
              robustness.ranges.technicalSpeichergrenzeKwh.min,
              robustness.ranges.technicalSpeichergrenzeKwh.max
            ),
          },
          {
            label: "Eigenverbrauchsquote",
            primary: formatOptionalReportPct(bdew.eigenverbrauchsquotePct),
            range: formatReportRangePct(
              robustness.ranges.eigenverbrauchsquotePct.min,
              robustness.ranges.eigenverbrauchsquotePct.max
            ),
          },
          {
            label: "Autarkie",
            primary: formatOptionalReportPct(bdew.autarkiePct),
            range: formatReportRangePct(
              robustness.ranges.autarkiePct.min,
              robustness.ranges.autarkiePct.max
            ),
          },
        ]}
      />

      <p className="mt-6 max-w-reading text-sm leading-relaxed text-ink">
        {householdRobustnessConclusion(robustness)}
      </p>

      <DetailsToggle
        open={showDetails}
        onToggle={() => setShowDetails((value) => !value)}
        closedLabel="Details anzeigen"
        openLabel="Details ausblenden"
      >
        <ul className="divide-y divide-line-soft border-y border-line-soft">
          {robustness.sizeFrequency.map((row) => (
            <li
              key={row.sizeKwh}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <span className="text-sm tabular-nums text-ink">
                {row.sizeKwh} kWh
              </span>
              <span className="text-sm tabular-nums text-ink-secondary">
                {row.householdCount}{" "}
                {row.householdCount === 1 ? "Haushalt" : "Haushalte"}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <caption className="sr-only">
              Einzelergebnisse der {n} gemessenen Haushaltsprofile
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th
                  scope="col"
                  className="bg-surface-muted px-3 py-2 text-left text-xs font-semibold tracking-wide text-ink"
                >
                  Profil
                </th>
                <th
                  scope="col"
                  className="bg-surface-muted px-3 py-2 text-right text-xs font-semibold tracking-wide text-ink"
                >
                  Speichergröße
                </th>
                <th
                  scope="col"
                  className="bg-surface-muted px-3 py-2 text-right text-xs font-semibold tracking-wide text-ink"
                >
                  Eigenverbrauch
                </th>
                <th
                  scope="col"
                  className="bg-surface-muted px-3 py-2 text-right text-xs font-semibold tracking-wide text-ink"
                >
                  Autarkie
                </th>
              </tr>
            </thead>
            <tbody>
              {robustness.houses.map((house, index) => (
                <tr key={house.houseId} className="border-b border-line-soft">
                  <th
                    scope="row"
                    className="px-3 py-2 text-left font-medium text-ink"
                  >
                    {anonymizedProfileLabel(index)}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                    {house.technicalSpeichergrenzeKwh} kWh
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                    {formatReportKwh(house.eigenverbrauchKwh)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                    {formatReportPct(house.autarkiePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailsToggle>
    </section>
  );
}

function WwRobustnessBlock({
  ww,
  bdew,
}: {
  ww: WwRobustnessPayload;
  bdew: BdewReportValues;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const n = ww.cohortSize;

  return (
    <section
      aria-labelledby="ww-robustness-heading"
      className="mt-8 border-t border-line pt-8 lg:mt-10 lg:pt-10"
    >
      <h2
        id="ww-robustness-heading"
        className="max-w-reading text-lg font-semibold leading-snug text-ink"
      >
        {WW_ROBUSTNESS_QUESTION}
      </h2>

      <div className="mt-4 max-w-reading space-y-5 text-sm leading-relaxed text-ink-secondary">
        {wwRobustnessExplanation(n).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p>{WW_HEAT_PUMP_DIFFER_EXPLANATION}</p>
      </div>

      <RobustnessCompareTable
        caption={`Hauptrechnung Wasser/Wasser-Referenzprofil im Vergleich mit ${n} realen Wasser/Wasser-Profilen`}
        primaryLabel="Hauptrechnung · Wasser/Wasser-Referenzprofil"
        rangeLabel={`${n} reale Wasser/Wasser-Profile`}
        rows={[
          {
            label: "Technische Speichergrenze",
            primary: formatOptionalReportKwh(
              typeof bdew.technicalSpeichergrenzeKwh === "number"
                ? bdew.technicalSpeichergrenzeKwh
                : ww.productionTechnicalSizeKwh
            ),
            range: formatReportRangeKwh(
              ww.aggregates.technicalSpeichergrenzeKwh.min,
              ww.aggregates.technicalSpeichergrenzeKwh.max
            ),
          },
          {
            label: "Eigenverbrauchsquote",
            primary: formatOptionalReportPct(bdew.eigenverbrauchsquotePct),
            range: formatReportRangePct(
              ww.aggregates.eigenverbrauchsquotePct.min,
              ww.aggregates.eigenverbrauchsquotePct.max
            ),
          },
          {
            label: "Autarkie",
            primary: formatOptionalReportPct(bdew.autarkiePct),
            range: formatReportRangePct(
              ww.aggregates.autarkiePct.min,
              ww.aggregates.autarkiePct.max
            ),
          },
        ]}
      />

      <p className="mt-6 max-w-reading text-sm leading-relaxed text-ink">
        {wwRobustnessConclusion(ww)}
      </p>

      <DetailsToggle
        open={showDetails}
        onToggle={() => setShowDetails((value) => !value)}
        closedLabel="Details anzeigen"
        openLabel="Details ausblenden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <caption className="sr-only">
              Einzelergebnisse der {n} gemessenen Wasser/Wasser-Profile
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th
                  scope="col"
                  className="bg-surface-muted px-3 py-2 text-left text-xs font-semibold tracking-wide text-ink"
                >
                  Profil
                </th>
                <th
                  scope="col"
                  className="bg-surface-muted px-3 py-2 text-right text-xs font-semibold tracking-wide text-ink"
                >
                  Speichergröße
                </th>
                <th
                  scope="col"
                  className="bg-surface-muted px-3 py-2 text-right text-xs font-semibold tracking-wide text-ink"
                >
                  Eigenverbrauch
                </th>
                <th
                  scope="col"
                  className="bg-surface-muted px-3 py-2 text-right text-xs font-semibold tracking-wide text-ink"
                >
                  Autarkie
                </th>
              </tr>
            </thead>
            <tbody>
              {ww.profiles.map((profile, index) => (
                <tr
                  key={`${index}-${profile.houseId}`}
                  className="border-b border-line-soft"
                >
                  <th
                    scope="row"
                    className="px-3 py-2 text-left font-medium text-ink"
                  >
                    {anonymizedProfileLabel(index)}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                    {profile.technicalSpeichergrenzeKwh} kWh
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                    {formatReportKwh(profile.eigenverbrauchKwh)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                    {formatReportPct(profile.autarkiePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailsToggle>
    </section>
  );
}

export function WpuqRobustnessSection({
  robustness,
  wasserWasserRobustness = null,
  bdew,
}: WpuqRobustnessSectionProps) {
  return (
    <>
      <HouseholdRobustnessBlock robustness={robustness} bdew={bdew} />
      {shouldShowWwRobustnessSection(wasserWasserRobustness) &&
      wasserWasserRobustness ? (
        <WwRobustnessBlock ww={wasserWasserRobustness} bdew={bdew} />
      ) : null}
    </>
  );
}
