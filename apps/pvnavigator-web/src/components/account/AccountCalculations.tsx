import { CalculationsEmptyState, CalculationsHistory } from "./CalculationsHistory";
import { TrustpilotInvitation } from "./TrustpilotInvitation";
import type { CalculationListRow } from "@/lib/calculationsList";

export function AccountCalculations({
  calculations,
  calculateUrl,
  loadError = false,
  trustpilotShow = false,
  trustpilotRecordShown = false,
}: {
  calculations: CalculationListRow[];
  calculateUrl: string;
  loadError?: boolean;
  trustpilotShow?: boolean;
  trustpilotRecordShown?: boolean;
}) {
  return (
    <section aria-labelledby="calculations-heading" className="hub-panel hub-results">
      <div className="hub-panel-heading">
        <h2 id="calculations-heading">Meine Berechnungen</h2>
        <span className="hub-count">{loadError ? "—" : calculations.length}</span>
      </div>
      <p className="hub-section-note">Gespeicherte Analysen öffnen und Ergebnisse nachvollziehen.</p>
      {loadError ? (
        <p role="alert" className="hub-notice">Die Berechnungen konnten nicht geladen werden. Bitte laden Sie die Seite erneut.</p>
      ) : calculations.length ? (
        <CalculationsHistory rows={calculations} />
      ) : (
        <CalculationsEmptyState calculateUrl={calculateUrl} />
      )}
      <TrustpilotInvitation show={trustpilotShow && !loadError} recordShown={trustpilotRecordShown} />
    </section>
  );
}
