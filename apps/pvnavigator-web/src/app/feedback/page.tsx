import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { FeedbackList } from "@/components/feedback/FeedbackList";
import { AuthEnvMissing } from "@/components/auth/AuthEnvMissing";
import { feedbackHint } from "@/lib/feedback";
import { loadFeedbackCalculations, loadOwnFeedback } from "@/lib/feedbackServer";
import { getServerUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Feedback & Support | PVNAVIGATOR_",
  description: "Rückmeldung zu den Produkten von PVNAVIGATOR_.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ hinweis?: string | string[] }>;

export default async function FeedbackPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="hub-workspace">
        <h1>Feedback & Support</h1>
        <AuthEnvMissing />
      </div>
    );
  }
  const user = await getServerUser();
  if (!user) redirect("/anmelden?next=/feedback");

  const hintParam = await searchParams;
  const hintKey = Array.isArray(hintParam.hinweis) ? hintParam.hinweis[0] : hintParam.hinweis;
  const [feedback, calculations] = await Promise.all([
    loadOwnFeedback(),
    loadFeedbackCalculations(user.id),
  ]);

  return (
    <div className="hub-workspace">
      <header className="hub-intro">
        <div>
          <p className="hub-kicker">PVNAVIGATOR_</p>
          <h1>Feedback & Support</h1>
          <p className="hub-subtitle">
            Haben Sie einen Fehler entdeckt oder eine Idee für unsere Produkte? Schreiben Sie uns! Wir freuen uns über Ihre Vorschläge und prüfen jede Rückmeldung.
          </p>
        </div>
      </header>
      <div className="hub-account-details">
        <section className="hub-panel hub-account" aria-labelledby="new-feedback-heading">
          <h2 id="new-feedback-heading" className="hub-kicker">Neue Anfrage</h2>
          <div className="mt-4">
            <FeedbackForm calculations={calculations} hint={feedbackHint(hintKey)} />
          </div>
        </section>
        <section className="hub-panel" aria-labelledby="own-feedback-heading">
          <div className="hub-panel-heading">
            <h2 id="own-feedback-heading">Meine Anfragen</h2>
            <span className="hub-count">{feedback.status === "ok" ? feedback.data.unread : "—"}</span>
          </div>
          {feedback.status === "ok" ? (
            <FeedbackList threads={feedback.data.threads} />
          ) : (
            <p role="alert" className="hub-notice">Die Anfragen konnten nicht geladen werden. Bitte laden Sie die Seite erneut.</p>
          )}
        </section>
      </div>
    </div>
  );
}
