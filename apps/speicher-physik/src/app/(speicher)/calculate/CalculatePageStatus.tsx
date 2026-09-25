import type { CalculateHeaderStatus } from "../components/headerCtaContext";

const STATUS_COPY: Record<
  CalculateHeaderStatus,
  { title: string; detail: string | null }
> = {
  input: { title: "Eingabe", detail: "Bitte Daten eingeben" },
  calculating: { title: "Eingabe gesperrt", detail: null },
  complete: { title: "Berechnet", detail: "Berechnung abgeschlossen" },
  editing: { title: "Eingaben aktiv", detail: null },
  stale: { title: "Ergebnis nicht aktuell", detail: null },
};

function BerechnetCap() {
  return (
    <svg
      className="sg-status-cap"
      viewBox="0 0 20 20"
      aria-hidden
    >
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path
        d="m5.5 10 3 3 6-6"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusMark({ status }: { status: CalculateHeaderStatus }) {
  const markClass =
    status === "stale"
      ? "bg-warning"
      : status === "input"
        ? "bg-warning"
        : "bg-ink-muted";

  return (
    <span
      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${markClass}`}
      aria-hidden
    />
  );
}

export function CalculatePageStatus({
  status,
}: {
  status: CalculateHeaderStatus;
}) {
  const copy = STATUS_COPY[status];

  const complete = status === "complete";

  return (
    <p className="sg-print-hide flex items-start gap-2" role="status">
      {complete ? null : <StatusMark status={status} />}
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-[1.45] text-ink">
          {complete ? <BerechnetCap /> : null}
          {copy.title}
        </span>
        {copy.detail ? (
          <span
            className={`block text-sm font-normal leading-snug text-ink-muted ${
              complete ? "sg-status-detail" : "mt-0.5"
            }`}
          >
            {copy.detail}
          </span>
        ) : null}
      </span>
    </p>
  );
}
