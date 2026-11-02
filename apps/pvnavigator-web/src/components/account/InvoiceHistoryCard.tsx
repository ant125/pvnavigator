import { BillingPostButton } from "@/components/tariffs/BillingPostButton";

const card =
  "rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] sm:px-6";

/**
 * Opens the invoice-history portal. Rendered only when this account has invoices.
 * Subscription management stays on the access card.
 */
export function InvoiceHistoryCard() {
  return (
    <div className={card}>
      <h2 id="invoices-heading" className="text-[0.95rem] font-semibold text-[#0F172A]">
        Rechnungen
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#334155]">
        Ihre bisherigen Rechnungen bleiben nach Kündigung oder Ablauf des Abonnements verfügbar.
      </p>
      <div className="mt-4 w-full max-w-[22.5rem]">
        <BillingPostButton
          action="/api/billing/invoices"
          label="Rechnungen ansehen"
          pendingLabel="Wird geöffnet…"
          tone="ghost"
        />
      </div>
    </div>
  );
}
