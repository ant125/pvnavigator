import {
  calculationDisplayName,
  formatListingDate,
  formatListingKwh,
  formatListingKwP,
  productLabel,
  type CalculationListRow,
} from "@/lib/calculationsList";

const card =
  "rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]";

const badge =
  "inline-flex w-fit rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 bg-emerald-50 text-emerald-800 ring-emerald-100/90";

const primaryBtn =
  "inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98]";

export function CalculationsEmptyState({ calculateUrl }: { calculateUrl: string }) {
  return (
    <div className={`mt-4 px-5 py-8 sm:px-8 sm:py-10 ${card}`}>
      <p className="text-sm font-medium text-[#0F172A]">
        Noch keine Berechnungen vorhanden.
      </p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#64748B]">
        Ihre abgeschlossenen PVNavigator-Analysen werden künftig hier gespeichert.
      </p>
      <a href={calculateUrl} className={`${primaryBtn} mt-6`}>
        Neue Berechnung
      </a>
    </div>
  );
}

export function CalculationsHistory({ rows }: { rows: CalculationListRow[] }) {
  return (
    <ul className="mt-4 grid gap-3">
      {rows.map((row) => {
        const kwp = formatListingKwP(row.summary_pv_kwp);
        const kwh = formatListingKwh(row.summary_consumption_kwh);
        const meta = [kwp, kwh].filter(Boolean).join(" · ");
        return (
          <li key={row.id} className={`px-5 py-5 sm:px-6 ${card}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.95rem] font-semibold text-[#0F172A]">
                {productLabel(row.product_key)}
              </p>
              <span className={badge}>Abgeschlossen</span>
            </div>
            <p className="mt-2 text-sm text-[#0F172A]">
              {calculationDisplayName(row)}
            </p>
            {meta ? (
              <p className="mt-1.5 text-sm text-[#64748B]">{meta}</p>
            ) : null}
            <p className="mt-1.5 text-xs text-[#94a3b8]">
              {formatListingDate(row.updated_at)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

