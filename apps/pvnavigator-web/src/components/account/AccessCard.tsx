const card =
  "hub-panel hub-access";

const badge =
  "hub-status";

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
