import Link from "next/link";

import type { FeedbackThreadSummary } from "@/lib/feedback";
import { calculationDisplayName, calculationResultHref, formatListingDate, type CalculationListRow } from "@/lib/calculationsList";
import { AccessCard } from "./AccessCard";
import { InvoiceHistoryCard } from "./InvoiceHistoryCard";
import { FeedbackList } from "@/components/feedback/FeedbackList";

type Props = {
  calculations: CalculationListRow[];
  hasInvoices: boolean;
  invoiceHint?: string;
  calculateUrl: string;
  loadError?: boolean;
  isAdmin?: boolean;
  feedbackThreads?: FeedbackThreadSummary[];
  feedbackUnread?: number | null;
  feedbackError?: boolean;
};

function unreadText(count: number): string {
  if (count === 0) return "Keine neuen Antworten";
  if (count === 1) return "1 neue Antwort";
  return `${count} neue Antworten`;
}

export function AccountOverview({
  calculations,
  hasInvoices,
  invoiceHint,
  calculateUrl,
  loadError = false,
  isAdmin = false,
  feedbackThreads = [],
  feedbackUnread = null,
  feedbackError = false,
}: Props) {
  const recentCalculations = calculations.slice(0, 3);
  const recentFeedback = feedbackThreads.slice(0, 3);
  return (
    <div className="account-overview">
      <div className="account-actions">
        <a href={calculateUrl} className="hub-primary">Neue Berechnung <span aria-hidden="true">↗</span></a>
        <Link href="/feedback" className="hub-secondary">Neue Anfrage</Link>
      </div>
      {invoiceHint ? <p role="status" className="hub-notice">{invoiceHint}</p> : null}
      {loadError ? <p role="alert" className="hub-notice">Die Berechnungen konnten nicht geladen werden. Bitte laden Sie die Seite erneut.</p> : null}
      {feedbackError ? <p role="alert" className="hub-notice">Die Anfragen konnten nicht geladen werden. Bitte laden Sie die Seite erneut.</p> : null}
      <div className="account-stat-grid">
        <Link href="/konto/berechnungen" className="account-stat">
          <span className="hub-kicker">Meine Berechnungen</span>
          <strong>{loadError ? "—" : calculations.length}</strong>
          <span>Gespeicherte Analysen</span>
        </Link>
        <AccessCard />
        <Link href="/feedback" className="account-stat">
          <span className="hub-kicker">Feedback & Support</span>
          <strong>{feedbackError || feedbackUnread == null ? "—" : feedbackUnread}</strong>
          <span>{feedbackError || feedbackUnread == null ? "Nicht geladen" : unreadText(feedbackUnread)}</span>
        </Link>
      </div>
      {recentCalculations.length > 0 ? (
        <section className="hub-panel" aria-labelledby="recent-calculations-heading">
          <div className="hub-panel-heading">
            <h2 id="recent-calculations-heading">Letzte Berechnungen</h2>
            <Link href="/konto/berechnungen" className="account-more">Alle anzeigen</Link>
          </div>
          <ul className="account-recent">
            {recentCalculations.map((row) => {
              const href = calculationResultHref(row);
              const label = calculationDisplayName(row);
              return (
                <li key={row.id}>
                  <div>
                    {href ? <a href={href}>{label}</a> : <strong>{label}</strong>}
                    <span>{formatListingDate(row.updated_at)}</span>
                  </div>
                  {href ? <a href={href}>Bericht ansehen</a> : <span>Berichtzugriff noch nicht verfügbar</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {recentFeedback.length > 0 ? (
        <section className="hub-panel" aria-labelledby="recent-feedback-heading">
          <div className="hub-panel-heading">
            <h2 id="recent-feedback-heading">Letzte Anfragen</h2>
            <Link href="/feedback" className="account-more">Alle Anfragen</Link>
          </div>
          <FeedbackList threads={recentFeedback} />
        </section>
      ) : null}
      {hasInvoices ? <section aria-labelledby="invoices-heading"><InvoiceHistoryCard /></section> : null}
      {isAdmin ? (
        <section className="hub-panel hub-account" aria-labelledby="administration-heading">
          <h2 id="administration-heading" className="hub-kicker">Administration</h2>
          <p className="mt-2.5">Geschützter Bereich für die Verwaltung von PVNAVIGATOR_.</p>
          <Link href="/admin" className="hub-text-link">Administration öffnen →</Link>
        </section>
      ) : null}
    </div>
  );
}
