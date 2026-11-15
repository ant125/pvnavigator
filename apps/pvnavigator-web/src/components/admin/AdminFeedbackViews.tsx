import Link from "next/link";

import { FeedbackConversation } from "@/components/feedback/FeedbackConversation";
import { RefreshUnreadNav } from "@/components/feedback/RefreshUnreadNav";
import {
  FEEDBACK_STATUSES,
  feedbackCategoryLabel,
  feedbackProductLabel,
  feedbackStatusLabel,
  formatFeedbackDateTime,
  type AdminFeedbackList,
  type AdminFeedbackThread,
} from "@/lib/feedback";

const field = "block text-sm font-medium text-[#29332e]";

export function AdminFeedbackListView({ data }: { data: AdminFeedbackList }) {
  const previous = data.page > 1 ? `/admin/feedback?seite=${data.page - 1}` : null;
  const next = data.page * data.pageSize < data.total ? `/admin/feedback?seite=${data.page + 1}` : null;
  return (
    <section className="hub-panel admin-block admin-feedback-list" aria-labelledby="admin-feedback-heading">
      <div className="hub-panel-heading">
        <h2 id="admin-feedback-heading">Anfragen</h2>
        <span className="hub-count">{data.total}</span>
      </div>
      {data.threads.length === 0 ? <p className="hub-section-note">Keine Anfragen.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-feedback-table">
            <thead>
              <tr>
                <th>Thema</th>
                <th>Produkt</th>
                <th>Kategorie</th>
                <th>Autor</th>
                <th>Datum</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.threads.map((thread) => (
                <tr key={thread.id}>
                  <td data-label="Thema">
                    <Link href={`/admin/feedback/${thread.id}`}>{thread.subject}</Link>
                    {thread.unread ? <span className="hub-status ml-2">Neue Nachricht</span> : null}
                  </td>
                  <td data-label="Produkt">{feedbackProductLabel(thread.productKey)}</td>
                  <td data-label="Kategorie">{feedbackCategoryLabel(thread.category)}</td>
                  <td data-label="Autor">{thread.email ?? "Nicht verfügbar"}</td>
                  <td data-label="Datum">{formatFeedbackDateTime(thread.createdAt)}</td>
                  <td data-label="Status">{feedbackStatusLabel(thread.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="admin-pager" aria-label="Seiten">
        {previous ? <Link href={previous}>Zurück</Link> : <span>Zurück</span>}
        <p>Seite {data.page}</p>
        {next ? <Link href={next}>Weiter</Link> : <span>Weiter</span>}
      </nav>
    </section>
  );
}

function engineVersions(thread: AdminFeedbackThread): string | null {
  const parts = [
    thread.batteryModelVersion ? `Rechenkern ${thread.batteryModelVersion}` : null,
    thread.inputSchemaVersion ? `Eingabe ${thread.inputSchemaVersion}` : null,
    thread.resultSchemaVersion ? `Ergebnis ${thread.resultSchemaVersion}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : null;
}

export function AdminFeedbackThreadView({
  thread,
  hint,
  wasUnread,
}: {
  thread: AdminFeedbackThread;
  hint?: string | null;
  wasUnread: boolean;
}) {
  const versions = engineVersions(thread);
  return (
    <>
      <RefreshUnreadNav active={wasUnread} />
      <section className="hub-panel admin-thread-summary" aria-labelledby="admin-thread-heading">
        <h2 id="admin-thread-heading">{thread.subject}</h2>
        <dl>
          <div>
            <dt>Produkt</dt>
            <dd>{feedbackProductLabel(thread.productKey)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{feedbackStatusLabel(thread.status)}</dd>
          </div>
          <div>
            <dt>Datum</dt>
            <dd>{formatFeedbackDateTime(thread.createdAt)}</dd>
          </div>
        </dl>
        <details className="admin-thread-details">
          <summary>
            <span className="when-closed">Details anzeigen</span>
            <span className="when-open">Details ausblenden</span>
          </summary>
          <dl className="admin-user-meta">
            <div>
              <dt>Autor</dt>
              <dd>{thread.displayName ?? "Nicht angegeben"}</dd>
            </div>
            <div>
              <dt>E-Mail</dt>
              <dd>{thread.email ?? "Nicht verfügbar"}</dd>
            </div>
            <div>
              <dt>Kategorie</dt>
              <dd>{feedbackCategoryLabel(thread.category)}</dd>
            </div>
            <div>
              <dt>Berechnung</dt>
              <dd>{thread.calculationId ?? "Keine"}</dd>
            </div>
            {versions ? (
              <div>
                <dt>Rechenkern</dt>
                <dd>{versions}</dd>
              </div>
            ) : null}
          </dl>
          <Link href={`/admin/nutzer/${thread.userId}`} className="hub-text-link">Profil öffnen</Link>
        </details>
      </section>
      <FeedbackConversation
        messages={thread.messages}
        reply={{
          action: `/admin/feedback/${thread.id}/antwort`,
          fieldId: "admin-feedback-reply",
          hint,
        }}
      />
      <section className="hub-panel hub-account admin-thread-status" aria-labelledby="admin-status-heading">
        <h2 id="admin-status-heading" className="hub-kicker">Status</h2>
        <form action={`/admin/feedback/${thread.id}/status`} method="post" className="mt-3 space-y-3">
          <div>
            <label htmlFor="admin-feedback-status" className={field}>Status ändern</label>
            <select id="admin-feedback-status" name="status" className="hub-input" defaultValue={thread.status}>
              {FEEDBACK_STATUSES.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="hub-secondary">Status speichern</button>
        </form>
      </section>
    </>
  );
}
