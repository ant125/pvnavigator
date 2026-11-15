import Link from "next/link";

import { FeedbackConversation } from "@/components/feedback/FeedbackConversation";
import { RefreshUnreadNav } from "@/components/feedback/RefreshUnreadNav";
import {
  feedbackCategoryLabel,
  feedbackProductLabel,
  feedbackStatusLabel,
  formatFeedbackDateTime,
  type FeedbackThread,
} from "@/lib/feedback";

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
    <>
      <RefreshUnreadNav active={wasUnread} />
      <p className="account-thread-meta">
        {feedbackProductLabel(thread.productKey)}
        {" · "}
        {feedbackCategoryLabel(thread.category)}
        {" · "}
        {feedbackStatusLabel(thread.status)}
        {" · "}
        {formatFeedbackDateTime(thread.createdAt)}
      </p>
      <FeedbackConversation
        messages={thread.messages}
        reply={{
          action: `/feedback/${thread.id}/antwort`,
          fieldId: "feedback-reply",
          hint,
          note: thread.status === "beantwortet" || thread.status === "erledigt"
            ? "Eine neue Nachricht setzt die Anfrage wieder auf Neu."
            : null,
        }}
      />
      <Link href="/feedback" className="hub-text-link">Alle Anfragen</Link>
    </>
  );
}
