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

function StatusMark({ status }: { status: CalculateHeaderStatus }) {
  if (status === "complete") {
    return (
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] leading-none text-white"
        aria-hidden
      >
        ✓
      </span>
    );
  }

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

  return (
    <p className="flex items-start gap-2" role="status">
      <StatusMark status={status} />
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-snug text-ink">
          {copy.title}
        </span>
        {copy.detail ? (
          <span className="mt-0.5 block text-sm font-normal leading-snug text-ink-muted">
            {copy.detail}
          </span>
        ) : null}
      </span>
    </p>
  );
}
