import Link from "next/link";
import { AccessCard } from "./AccessCard";
import { InvoiceHistoryCard } from "./InvoiceHistoryCard";
import { CalculationsEmptyState, CalculationsHistory } from "./CalculationsHistory";
import type { CalculationListRow } from "@/lib/calculationsList";

type Props = { email: string; calculations: CalculationListRow[]; hasInvoices: boolean; invoiceHint?: string; calculateUrl: string; speicherOrigin: string; loadError?: boolean; isAdmin?: boolean };
export function AccountDashboard({email, calculations, hasInvoices, invoiceHint, calculateUrl, loadError, isAdmin}: Props) {
 return <div className="hub-workspace">
   <header className="hub-intro">
     <div><p className="hub-kicker">PVNAVIGATOR_ / Arbeitsbereich</p><h1>Mein Konto</h1><p className="hub-subtitle">Ihre gespeicherten Berechnungen und Berichte.</p></div>
     <a href={calculateUrl} className="hub-primary">Neue Berechnung <span aria-hidden="true">↗</span></a>
   </header>
   {invoiceHint && <p role="status" className="hub-notice">{invoiceHint}</p>}
   <div className="hub-dashboard-grid">
     <section aria-labelledby="calculations-heading" className="hub-panel hub-results">
       <div className="hub-panel-heading"><h2 id="calculations-heading">Meine Berechnungen</h2><span className="hub-count">{loadError ? '—' : calculations.length}</span></div>
       <p className="hub-section-note">Gespeicherte Analysen öffnen und Ergebnisse nachvollziehen.</p>
       {loadError ? <p role="alert" className="hub-notice">Die Berechnungen konnten nicht geladen werden. Bitte laden Sie die Seite erneut.</p> : calculations.length ? <CalculationsHistory rows={calculations}/> : <CalculationsEmptyState calculateUrl={calculateUrl}/>}
     </section>
   </div>
     <div className="hub-account-details" aria-label="Konto und Zugang">
       <section aria-label="Zugang"><AccessCard/></section>
       <section className="hub-panel hub-account" aria-labelledby="account-heading"><h2 id="account-heading" className="hub-kicker">Kontoinformationen</h2><p className="hub-email">{email}</p><p>Angemeldetes PVNAVIGATOR_ Konto</p><Link href="/" className="hub-text-link">Zur Plattformübersicht →</Link></section>
       {hasInvoices && <section aria-labelledby="invoices-heading"><InvoiceHistoryCard/></section>}
       {/* Convenience only: /admin checks the role itself on every request. */}
       {isAdmin && <section className="hub-panel hub-account" aria-labelledby="administration-heading"><h2 id="administration-heading" className="hub-kicker">Administration</h2><p className="mt-2.5">Geschützter Bereich für die Verwaltung von PVNAVIGATOR_.</p><Link href="/admin" className="hub-text-link">Administration öffnen →</Link></section>}
     </div>
 </div>;
}
