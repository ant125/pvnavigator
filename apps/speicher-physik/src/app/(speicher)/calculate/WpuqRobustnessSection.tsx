"use client";

import { useState } from "react";
import Link from "next/link";
import type { WpuqRobustnessPayload } from "@/lib/wpuqRobustnessStats";
import { getReportMethodologySources } from "@/lib/reportMethodologySources";

type BdewReportValues = {
  eigenverbrauchKwh: number | null;
  eigenverbrauchsquotePct: number | null;
  autarkiePct: number | null;
};

type WpuqRobustnessSectionProps = {
  robustness: WpuqRobustnessPayload;
  bdew: BdewReportValues;
};

function householdWord(count: number): string {
  return count === 1 ? "Haushalt" : "Haushalte";
}

function formatKwh(value: number): string {
  return `${Math.round(value)} kWh`;
}

function formatPct(value: number): string {
  return `${Math.round(value)} %`;
}

function formatRangeKwh(min: number, max: number): string {
  return `${Math.round(min)}–${Math.round(max)} kWh`;
}

function formatRangePct(min: number, max: number): string {
  return `${Math.round(min)}–${Math.round(max)} %`;
}

function formatBdewKwh(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatKwh(value)
    : "—";
}

function formatBdewPct(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value} %`
    : "—";
}

export function ReportQuellenSection() {
  const sources = getReportMethodologySources();

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

export function WpuqRobustnessSection({
  robustness,
  bdew,
}: WpuqRobustnessSectionProps) {
  const [showHouses, setShowHouses] = useState(false);
  const [showMinMax, setShowMinMax] = useState(false);
  const n = robustness.cohortSize;

  return (
    <section
      aria-labelledby="wpuq-robustness-heading"
      className="mt-8 border-t border-line pt-8 lg:mt-10 lg:pt-10"
    >
        <h2
          id="wpuq-robustness-heading"
          className="text-lg font-semibold text-ink"
        >
          Robustheitsprüfung mit realen Smart-Meter-Profilen
        </h2>

        <div className="mt-4 max-w-reading space-y-3 text-sm leading-relaxed text-ink-secondary">
          <p>
            Um zu prüfen, wie empfindlich diese Empfehlung gegenüber
            unterschiedlichem Haushaltsverhalten ist, hat PVNavigator genau
            dieselbe Simulation mit {n} vollständig gemessenen deutschen
            Smart-Meter-Haushaltsprofilen wiederholt.
          </p>
          <p>
            Geändert wurde nur das Haushaltslastprofil. Alles andere blieb
            identisch: Dach, PV-Anlage, Wetterjahre, Jahresverbrauch,
            Batteriemodell und Simulationsphysik.
          </p>
          <p>
            Jedes gemessene Profil wurde zuvor auf den angegebenen
            Jahresverbrauch von {formatKwh(robustness.householdAnnualKwh)}{" "}
            skaliert.
          </p>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold tracking-wide text-ink">
            Technische Speichergröße
          </h3>
          <ul className="mt-3 divide-y divide-line-soft border-y border-line-soft">
            {robustness.sizeFrequency.map((row) => (
              <li
                key={row.sizeKwh}
                className="flex items-baseline justify-between gap-4 py-2.5"
              >
                <span className="text-base font-semibold tabular-nums text-ink">
                  {row.sizeKwh} kWh
                </span>
                <span className="text-sm tabular-nums text-ink-secondary">
                  {row.householdCount} {householdWord(row.householdCount)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <caption className="mb-2 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
              BDEW H25 im Vergleich mit {n} realen Haushalten
            </caption>
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
                  BDEW
                </th>
                <th
                  scope="col"
                  className="bg-surface-muted px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-ink"
                >
                  {n} reale Haushalte
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line-soft">
                <th
                  scope="row"
                  className="px-3 py-2.5 text-left font-medium text-ink"
                >
                  Eigenverbrauch
                </th>
                <td className="px-3 py-2.5 tabular-nums text-ink">
                  {formatBdewKwh(bdew.eigenverbrauchKwh)}
                </td>
                <td className="px-3 py-2.5 text-ink-secondary">
                  <span className="block tabular-nums text-ink">
                    Median {formatKwh(robustness.ranges.eigenverbrauchKwh.median)}
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums">
                    P25–P75{" "}
                    {formatRangeKwh(
                      robustness.ranges.eigenverbrauchKwh.p25,
                      robustness.ranges.eigenverbrauchKwh.p75
                    )}
                  </span>
                </td>
              </tr>
              <tr className="border-b border-line-soft">
                <th
                  scope="row"
                  className="px-3 py-2.5 text-left font-medium text-ink"
                >
                  Eigenverbrauchsquote
                </th>
                <td className="px-3 py-2.5 tabular-nums text-ink">
                  {formatBdewPct(bdew.eigenverbrauchsquotePct)}
                </td>
                <td className="px-3 py-2.5 text-ink-secondary">
                  <span className="block tabular-nums text-ink">
                    Median{" "}
                    {formatPct(robustness.ranges.eigenverbrauchsquotePct.median)}
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums">
                    P25–P75{" "}
                    {formatRangePct(
                      robustness.ranges.eigenverbrauchsquotePct.p25,
                      robustness.ranges.eigenverbrauchsquotePct.p75
                    )}
                  </span>
                </td>
              </tr>
              <tr className="border-b border-line-soft">
                <th
                  scope="row"
                  className="px-3 py-2.5 text-left font-medium text-ink"
                >
                  Autarkie
                </th>
                <td className="px-3 py-2.5 tabular-nums text-ink">
                  {formatBdewPct(bdew.autarkiePct)}
                </td>
                <td className="px-3 py-2.5 text-ink-secondary">
                  <span className="block tabular-nums text-ink">
                    Median {formatPct(robustness.ranges.autarkiePct.median)}
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums">
                    P25–P75{" "}
                    {formatRangePct(
                      robustness.ranges.autarkiePct.p25,
                      robustness.ranges.autarkiePct.p75
                    )}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            aria-expanded={showMinMax}
            onClick={() => setShowMinMax((open) => !open)}
          >
            {showMinMax ? "Min–Max ausblenden" : "Min–Max anzeigen"}
          </button>
          {showMinMax ? (
            <dl className="mt-3 grid max-w-reading gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-secondary">Eigenverbrauch Min–Max</dt>
                <dd className="tabular-nums text-ink">
                  {formatRangeKwh(
                    robustness.ranges.eigenverbrauchKwh.min,
                    robustness.ranges.eigenverbrauchKwh.max
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-secondary">Autarkie Min–Max</dt>
                <dd className="tabular-nums text-ink">
                  {formatRangePct(
                    robustness.ranges.autarkiePct.min,
                    robustness.ranges.autarkiePct.max
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-secondary">Netzbezug Min–Max</dt>
                <dd className="tabular-nums text-ink">
                  {formatRangeKwh(
                    robustness.ranges.netzbezugKwh.min,
                    robustness.ranges.netzbezugKwh.max
                  )}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <div className="mt-6 max-w-reading space-y-3 text-sm leading-relaxed text-ink">
          {robustness.conclusionParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-6">
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            aria-expanded={showHouses}
            onClick={() => setShowHouses((open) => !open)}
          >
            {showHouses
              ? "Referenzprofile ausblenden"
              : `Alle ${n} Referenzprofile anzeigen`}
          </button>
          {showHouses ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-sm">
                <caption className="sr-only">
                  Einzelergebnisse der {n} WPuQ-Referenzprofile
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th
                      scope="col"
                      className="bg-surface-muted px-3 py-2 text-left text-xs font-semibold tracking-wide text-ink"
                    >
                      Haushalt
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
                    <th
                      scope="col"
                      className="bg-surface-muted px-3 py-2 text-right text-xs font-semibold tracking-wide text-ink"
                    >
                      Netzbezug
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {robustness.houses.map((house) => (
                    <tr key={house.houseId} className="border-b border-line-soft">
                      <th
                        scope="row"
                        className="px-3 py-2 text-left font-medium text-ink"
                      >
                        {house.houseId}
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                        {house.technicalSpeichergrenzeKwh} kWh
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                        {formatKwh(house.eigenverbrauchKwh)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                        {formatPct(house.autarkiePct)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                        {formatKwh(house.netzbezugKwh)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
    </section>
  );
}
