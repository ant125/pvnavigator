import { formatFeedbackDateTime, type FeedbackMessage } from "@/lib/feedback";

export function FeedbackConversation({
  messages,
  reply,
}: {
  messages: FeedbackMessage[];
  reply?: {
    action: string;
    fieldId: string;
    hint?: string | null;
    note?: string | null;
  };
}) {
  return (
    <div className="hub-chat-panel">
      <ol className="hub-chat" aria-label="Nachrichten">
        {messages.map((message) => {
          const support = message.authorRole === "admin";
          return (
            <li key={message.id} className={support ? "hub-chat-row is-support" : "hub-chat-row is-user"} data-role={message.authorRole}>
              <article className="hub-chat-bubble">
                <header>
                  <strong>{support ? "Support" : "Nutzer"}</strong>
                  <time dateTime={message.createdAt}>{formatFeedbackDateTime(message.createdAt)}</time>
                </header>
                <p>{message.body}</p>
              </article>
            </li>
          );
        })}
      </ol>
      {reply ? (
        <form action={reply.action} method="post" className="hub-chat-composer">
          {reply.hint ? <p role="alert" className="hub-notice">{reply.hint}</p> : null}
          {reply.note ? <p className="hub-chat-note">{reply.note}</p> : null}
          <label htmlFor={reply.fieldId} className="hub-sr">Nachricht</label>
          <textarea id={reply.fieldId} name="body" required maxLength={4000} rows={3} className="hub-input hub-chat-input" />
          <button type="submit" className="hub-primary">Senden</button>
        </form>
      ) : null}
    </div>
  );
}
