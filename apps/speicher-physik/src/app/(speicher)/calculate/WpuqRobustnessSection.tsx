"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  sizeFrequency,
  type WpuqRobustnessPayload,
} from "@/lib/wpuqRobustnessStats";
import type { WwRobustnessPayload } from "@/lib/wpuqWwRobustnessStats";
import { formatQuantityDe } from "@/lib/formatQuantityDe";
import {
  HOUSEHOLD_ROBUSTNESS_QUESTION,
  WW_HEAT_PUMP_DIFFER_EXPLANATION,
  WW_ROBUSTNESS_QUESTION,
  anonymizedProfileLabel,
  formatOptionalReportKwh,
  formatOptionalReportPct,
  formatReportKwh,
  formatReportPct,
  formatReportRangeKwh,
  formatReportRangePct,
  householdRobustnessExplanation,
  robustnessKpiFollow,
  robustnessStabilityNote,
  shouldShowWwRobustnessSection,
  technicalSizeRangeLead,
  wwRobustnessExplanation,
} from "@/lib/robustnessReportCopy";
import {
  getReportMethodologySources,
  type ReportEvCitation,
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

/** Local scroller for tables that are intentionally wider than a phone. */
const TABLE_SCROLL = "sg-table-scroll min-w-0 max-w-full overflow-x-auto";

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
    <div className={`mt-6 ${TABLE_SCROLL}`}>
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

function countNoun(count: number, singular: string, plural: string): string {
  return `${formatQuantityDe(count)} ${count === 1 ? singular : plural}`;
}

function SizeDistribution({
  rows,
  singular,
  plural,
}: {
  rows: readonly { sizeKwh: number; count: number }[];
  singular: string;
  plural: string;
}) {
  const ordered = [...rows].sort((a, b) => a.sizeKwh - b.sizeKwh);
  const max = Math.max(1, ...ordered.map((row) => row.count));

  return (
    <ul className="min-w-0 space-y-3">
      {ordered.map((row) => {
        const width = Math.max(8, Math.round((row.count / max) * 100));
        return (
          <li key={row.sizeKwh} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="tabular-nums text-ink">
                {formatQuantityDe(row.sizeKwh)} kWh
              </span>
              <span className="shrink-0 tabular-nums text-ink-secondary">
                {countNoun(row.count, singular, plural)}
              </span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-sm bg-surface-muted"
              aria-hidden
            >
              <div
                className="h-full rounded-sm bg-accent"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
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
      {open ? <div className="mt-4 min-w-0 max-w-full">{children}</div> : null}
    </div>
  );
}

export function ReportQuellenSection({
  heatPump,
  ev,
  id,
  hideHeading = false,
  framed = true,
}: {
  heatPump?: ReportHeatPumpCitation;
  ev?: ReportEvCitation;
  id?: string;
  hideHeading?: boolean;
  framed?: boolean;
}) {
  const sources = getReportMethodologySources(heatPump, ev);
  const Root = hideHeading ? "div" : "section";

  return (
    <Root
      id={hideHeading ? undefined : id}
      aria-labelledby={hideHeading ? undefined : "report-quellen-heading"}
      className={
        framed
          ? "mt-8 border-t border-line pt-8 lg:mt-10 lg:pt-10"
          : undefined
      }
    >
      {hideHeading ? null : (
        <h2
          id="report-quellen-heading"
          className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-accent-text"
        >
          Quellen & wissenschaftliche Grundlagen
        </h2>
      )}
      <p className="mt-3 max-w-reading text-sm leading-relaxed text-ink-secondary">
        Die ausführliche Dokumentation steht unter{" "}
        <Link
          href="/methodik"
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
    </Root>
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
  const follow = robustnessKpiFollow(robustness);

  return (
    <section
      aria-labelledby="household-robustness-heading"
      className="mt-8 min-w-0 max-w-full border-t border-line pt-8 lg:mt-10 lg:pt-10"
    >
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        Haushaltsprofile
      </p>
      <h2
        id="household-robustness-heading"
        className="mt-2 max-w-reading text-base font-semibold leading-snug text-ink"
      >
        {technicalSizeRangeLead(
          robustness.ranges.technicalSpeichergrenzeKwh.min,
          robustness.ranges.technicalSpeichergrenzeKwh.max,
          "Haushaltsprofile"
        )}
      </h2>
      {follow ? (
        <p className="mt-2 max-w-reading text-sm leading-snug text-ink-secondary">
          {follow}
        </p>
      ) : null}

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

      <div className="mt-8 max-w-reading space-y-4 text-sm leading-relaxed text-ink-secondary">
        <h3 className="text-sm font-semibold leading-snug text-ink">
          {HOUSEHOLD_ROBUSTNESS_QUESTION}
        </h3>
        {householdRobustnessExplanation(n).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p className="text-xs leading-relaxed text-ink-muted">
          {robustnessStabilityNote(robustness, "Profile")}
        </p>
      </div>

      <DetailsToggle
        open={showDetails}
        onToggle={() => setShowDetails((value) => !value)}
        closedLabel="Details anzeigen"
        openLabel="Details ausblenden"
      >
        <h3 className="text-sm font-semibold text-ink">
          Verteilung der technischen Speichergrenze
        </h3>
        <div className="mt-4 min-w-0">
          <SizeDistribution
            singular="Haushalt"
            plural="Haushalte"
            rows={robustness.sizeFrequency.map((row) => ({
              sizeKwh: row.sizeKwh,
              count: row.householdCount,
            }))}
          />
        </div>
        <div className="my-6 border-t border-line" />
        <h3 className="text-sm font-semibold text-ink">
          Einzelergebnisse der {n} Haushaltsprofile
        </h3>
        <div className={`mt-4 ${TABLE_SCROLL}`}>
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
  const follow = robustnessKpiFollow(ww);
  const distribution = sizeFrequency(
    ww.profiles.map((profile) => profile.technicalSpeichergrenzeKwh)
  );

  return (
    <section
      aria-labelledby="ww-robustness-heading"
      className="mt-8 min-w-0 max-w-full border-t border-line pt-8 lg:mt-10 lg:pt-10"
    >
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        Wasser/Wasser-Wärmepumpenprofile
      </p>
      <h2
        id="ww-robustness-heading"
        className="mt-2 max-w-reading text-base font-semibold leading-snug text-ink"
      >
        {technicalSizeRangeLead(
          ww.aggregates.technicalSpeichergrenzeKwh.min,
          ww.aggregates.technicalSpeichergrenzeKwh.max,
          "Wasser/Wasser-Profile"
        )}
      </h2>
      {follow ? (
        <p className="mt-2 max-w-reading text-sm leading-snug text-ink-secondary">
          {follow}
        </p>
      ) : null}

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

      <div className="mt-8 max-w-reading space-y-4 text-sm leading-relaxed text-ink-secondary">
        <h3 className="text-sm font-semibold leading-snug text-ink">
          {WW_ROBUSTNESS_QUESTION}
        </h3>
        {wwRobustnessExplanation(n).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p>{WW_HEAT_PUMP_DIFFER_EXPLANATION}</p>
        <p className="text-xs leading-relaxed text-ink-muted">
          {robustnessStabilityNote(ww, "Wärmepumpenprofile")}
        </p>
      </div>

      <DetailsToggle
        open={showDetails}
        onToggle={() => setShowDetails((value) => !value)}
        closedLabel="Details anzeigen"
        openLabel="Details ausblenden"
      >
        <h3 className="text-sm font-semibold text-ink">
          Verteilung der technischen Speichergrenze
        </h3>
        <div className="mt-4 min-w-0">
          <SizeDistribution
            singular="Profil"
            plural="Profile"
            rows={distribution.map((row) => ({
              sizeKwh: row.sizeKwh,
              count: row.householdCount,
            }))}
          />
        </div>
        <div className="my-6 border-t border-line" />
        <h3 className="text-sm font-semibold text-ink">
          Einzelergebnisse der {n} Wasser/Wasser-Profile
        </h3>
        <div className={`mt-4 ${TABLE_SCROLL}`}>
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
