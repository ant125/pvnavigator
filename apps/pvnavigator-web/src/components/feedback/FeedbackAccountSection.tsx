import Link from "next/link";

import { FeedbackList } from "@/components/feedback/FeedbackList";
import type { FeedbackThreadSummary } from "@/lib/feedback";

export function FeedbackAccountSection({
  threads,
  unread,
  error,
}: {
  threads: FeedbackThreadSummary[];
  unread: number;
  error?: boolean;
}) {
  const unreadLabel = unread === 0
    ? "Keine neuen Antworten"
    : unread === 1
      ? "1 neue Antwort"
      : `${unread} neue Antworten`;
  return (
    <section className="hub-panel hub-account" aria-labelledby="feedback-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="feedback-heading" className="hub-kicker">Feedback & Support</h2>
        {error ? null : <span className="hub-count">{unreadLabel}</span>}
      </div>
      <p className="mt-3">Fehler und Ideen zu den Produkten von PVNAVIGATOR_.</p>
      {error ? (
        <p role="alert" className="hub-notice">Die Anfragen konnten nicht geladen werden. Bitte laden Sie die Seite erneut.</p>
      ) : (
        <FeedbackList threads={threads} />
      )}
      <Link href="/feedback" className="hub-text-link">Neue Anfrage</Link>
    </section>
  );
}
