import Link from "next/link";

import {
  feedbackCategoryLabel,
  feedbackProductLabel,
  feedbackStatusLabel,
  formatFeedbackDateTime,
  type FeedbackThreadSummary,
} from "@/lib/feedback";

export function FeedbackList({
  threads,
  hrefFor,
}: {
  threads: FeedbackThreadSummary[];
  hrefFor?: (id: string) => string;
}) {
  if (threads.length === 0) {
    return <p className="hub-section-note">Sie haben noch keine Anfragen.</p>;
  }
  return (
    <ul className="hub-history">
      {threads.map((thread) => (
        <li key={thread.id} className="hub-history-row">
          <Link href={hrefFor ? hrefFor(thread.id) : `/feedback/${thread.id}`} className="block px-5 py-4">
            <span className="flex flex-wrap items-center gap-2">
              <strong className="text-sm">{thread.subject}</strong>
              {thread.unread ? <span className="hub-status">Neue Antwort</span> : null}
            </span>
            <span className="mt-1 block text-xs text-[#627067]">
              {feedbackProductLabel(thread.productKey)}
              {" · "}
              {feedbackCategoryLabel(thread.category)}
              {" · "}
              {feedbackStatusLabel(thread.status)}
              {" · "}
              {formatFeedbackDateTime(thread.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
