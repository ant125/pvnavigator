import Link from "next/link";

import { RefreshUnreadNav } from "@/components/feedback/RefreshUnreadNav";
import {
  feedbackCategoryLabel,
  feedbackProductLabel,
  feedbackStatusLabel,
  formatFeedbackDateTime,
  type FeedbackThread,
} from "@/lib/feedback";

const field = "block text-sm font-medium text-[#29332e]";

export function FeedbackThreadView({
  thread,
  hint,
  wasUnread,
}: {
  thread: FeedbackThread;
  hint?: string | null;
  wasUnread: boolean;
}) {
  return (
    <div className="hub-workspace">
      <RefreshUnreadNav active={wasUnread} />
      <header className="hub-intro">
        <div>
          <p className="hub-kicker">PVNAVIGATOR_ / Feedback & Support</p>
          <h1>{thread.subject}</h1>
          <p className="hub-subtitle">
            {feedbackProductLabel(thread.productKey)}
            {" · "}
            {feedbackCategoryLabel(thread.category)}
            {" · "}
            {feedbackStatusLabel(thread.status)}
            {" · "}
            {formatFeedbackDateTime(thread.createdAt)}
          </p>
        </div>
      </header>
      <ol className="hub-thread" aria-label="Nachrichten">
        {thread.messages.map((message) => (
          <li key={message.id} className="hub-message" data-role={message.authorRole}>
            <header>
              <strong>{message.authorRole === "admin" ? "PVNAVIGATOR_" : "Sie"}</strong>
              <time dateTime={message.createdAt}>{formatFeedbackDateTime(message.createdAt)}</time>
            </header>
            <p>{message.body}</p>
          </li>
        ))}
      </ol>
      <section className="hub-panel hub-account mt-5" aria-labelledby="reply-heading">
        <h2 id="reply-heading" className="hub-kicker">Antwort</h2>
        {thread.status === "beantwortet" || thread.status === "erledigt" ? (
          <p className="mt-3 text-sm text-[#627067]">Eine neue Nachricht setzt die Anfrage wieder auf Neu.</p>
        ) : null}
        <form action={`/feedback/${thread.id}/antwort`} method="post" className="mt-4 space-y-4">
          {hint ? <p role="alert" className="hub-notice">{hint}</p> : null}
          <div>
            <label htmlFor="feedback-reply" className={field}>Nachricht</label>
            <textarea id="feedback-reply" name="body" required maxLength={4000} rows={6} className="hub-input" />
          </div>
          <button type="submit" className="hub-primary">Antwort senden</button>
        </form>
      </section>
      <Link href="/feedback" className="hub-text-link">Alle Anfragen</Link>
    </div>
  );
}
