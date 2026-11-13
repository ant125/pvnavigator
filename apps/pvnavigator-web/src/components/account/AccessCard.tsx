const card =
  "rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]";

const badge =
  "inline-flex w-fit rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100/90";

/**
 * Account access while PVNAVIGATOR_ is free. Former subscriptions do not
 * change what this card shows.
 */
export function AccessCard() {
  return (
    <div className={`px-5 py-4 sm:px-6 ${card}`} data-access-kind="free">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[0.95rem] font-semibold text-[#0F172A]">Kostenloser Zugang</p>
        <span className={badge}>Kostenlos</span>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-[#0F172A]">
        <li>Beliebig viele unterschiedliche Adressen.</li>
        <li>PDF-Berichte sind enthalten.</li>
        <li>Auch die gewerbliche Nutzung ist kostenlos.</li>
      </ul>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#64748B]">
        Gespeicherte Berechnungen und Berichte bleiben in Ihrem Konto.
      </p>
    </div>
  );
}
