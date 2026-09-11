import { notFound, redirect } from "next/navigation";
import {
  getHubLoginUrlForSpeicherResult,
  isPvNavigatorUuid,
} from "@pv-auth/session";

import { SpeicherReportView } from "../../components/SpeicherReportView";
import { getServerUser } from "@/lib/auth";
import {
  HISTORICAL_SPEICHER_REPORT_SELECT,
  resolveHistoricalSpeicherReport,
  type CalculationHistoryRow,
} from "@/lib/historicalSpeicherReport";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function IncompatibleHistoricalReport({
  createdAt,
  batteryModelVersion,
  resultSchemaVersion,
}: {
  createdAt: string | null;
  batteryModelVersion: string | null;
  resultSchemaVersion: string | null;
}) {
  const savedAt = createdAt
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(createdAt))
    : null;

  return (
    <div className="min-w-0 max-w-full py-12">
      <div className="mx-auto min-w-0 w-full max-w-form px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-line bg-surface p-5 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Bericht nicht lesbar
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
            Dieser gespeicherte Bericht kann mit der aktuellen Version nicht
            angezeigt werden.
          </p>
          <dl className="mt-6 space-y-2 text-sm text-ink-secondary">
            {savedAt ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-muted">
                  Gespeichert am
                </dt>
                <dd className="mt-0.5 tabular-nums text-ink">{savedAt}</dd>
              </div>
            ) : null}
            {batteryModelVersion ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-muted">
                  Modellversion
                </dt>
                <dd className="mt-0.5 tabular-nums text-ink">
                  {batteryModelVersion}
                </dd>
              </div>
            ) : null}
            {resultSchemaVersion ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-muted">
                  Ergebnis-Schema
                </dt>
                <dd className="mt-0.5 tabular-nums text-ink">
                  {resultSchemaVersion}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </div>
  );
}

export default async function HistoricalSpeicherResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isPvNavigatorUuid(id)) {
    notFound();
  }

  const user = await getServerUser();
  if (!user) {
    redirect(getHubLoginUrlForSpeicherResult(id));
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("calculations")
    .select(HISTORICAL_SPEICHER_REPORT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load historical calculation", error);
  }

  const outcome = resolveHistoricalSpeicherReport({
    requestedId: id,
    row: (data as CalculationHistoryRow | null) ?? null,
  });

  if (outcome.status === "not_found") {
    notFound();
  }

  if (outcome.status === "incompatible") {
    return (
      <IncompatibleHistoricalReport
        createdAt={outcome.createdAt}
        batteryModelVersion={outcome.batteryModelVersion}
        resultSchemaVersion={outcome.resultSchemaVersion}
      />
    );
  }

  const { report } = outcome;

  return (
    <div className="min-w-0 max-w-full py-12">
      <SpeicherReportView
        mode="historical"
        verifiedResult={report.verifiedResult}
        speicherGrenz={report.speicherGrenz}
        robustness={report.robustness}
        wasserWasserRobustness={report.wasserWasserRobustness}
        ev={report.ev}
        heatPumpCitation={report.heatPumpCitation}
        displayAddress={report.displayAddress}
        surfaces={report.input.surfaces}
        input={report.input}
        totalKwPConfigured={report.input.totalKwPConfigured}
        presentationOverride={report.presentationOverride}
        savedAt={report.createdAt}
        batteryModelVersion={report.batteryModelVersion}
      />
    </div>
  );
}
