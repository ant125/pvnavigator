import { calculationAccessBadge } from "@/lib/accessSummary";
import {
  calculationDisplayName,
  calculationResultHref,
  formatListingDate,
  formatListingKwh,
  formatListingKwP,
  productLabel,
  type CalculationListRow,
} from "@/lib/calculationsList";

const card = "hub-history-row";
const badge = "hub-status";
const accessBadge = "hub-history-badge";
const primaryBtn = "hub-text-link";

export function CalculationsEmptyState({ calculateUrl }: { calculateUrl: string }) {
  return (
    <div className={`hub-empty ${card}`}>
      <p className="text-sm font-medium text-[#0F172A]">
        Noch keine Berechnungen vorhanden.
      </p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#64748B]">
        Starten Sie Ihre erste Speicheranalyse. Abgeschlossene Berechnungen finden Sie anschließend hier.
      </p>
      <a href={calculateUrl} className={`${primaryBtn} mt-6`}>
        Erste Berechnung starten →
      </a>
    </div>
  );
}

export function CalculationsHistory({ rows }: { rows: CalculationListRow[] }) {
  return (
    <ul className="hub-history">
      {rows.map((row) => {
        const kwp = formatListingKwP(row.summary_pv_kwp);
        const kwh = formatListingKwh(row.summary_consumption_kwh);
        const meta = [kwp, kwh].filter(Boolean).join(" · ");
        const href = calculationResultHref(row);
        const access = calculationAccessBadge(row.access_tier);
        const inner = (
            <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.95rem] font-semibold text-[#0F172A]">
                {productLabel(row.product_key)}
              </p>
              <span className={badge}>Abgeschlossen</span>
              {access ? (
                <span
                  className={accessBadge}
                  title="Gespeicherter Bericht"
                >
                  {access}
                </span>
              ) : null}
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
            </>
        );
        return (
          <li key={row.id} className={`px-5 py-4 ${card}`}>
            {href ? (
              <a
                href={href}
                className="block rounded-lg outline-offset-4 hover:opacity-95"
              >
                {inner}
              </a>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}

