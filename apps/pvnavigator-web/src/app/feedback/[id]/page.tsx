import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isPvNavigatorUuid } from "@pv-auth/session";

import { AccountShell } from "@/components/account/AccountShell";
import { FeedbackThreadView } from "@/components/feedback/FeedbackThreadView";
import { feedbackHint } from "@/lib/feedback";
import { loadOwnFeedbackThread, loadOwnFeedbackUnread } from "@/lib/feedbackServer";
import { getServerUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Anfrage | Feedback & Support | PVNAVIGATOR_",
  robots: { index: false, follow: false },
};

type RouteParams = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hinweis?: string | string[] }>;
};

export default async function FeedbackThreadPage({ params, searchParams }: RouteParams) {
  const { id } = await params;
  if (!isPvNavigatorUuid(id)) redirect("/feedback");
  if (!isSupabaseConfigured()) redirect("/feedback");
  const user = await getServerUser();
  if (!user) redirect(`/anmelden?next=${encodeURIComponent(`/feedback/${id.toLowerCase()}`)}`);

  const hintParam = await searchParams;
  const hintKey = Array.isArray(hintParam.hinweis) ? hintParam.hinweis[0] : hintParam.hinweis;
  let loaded;
  try {
    loaded = await loadOwnFeedbackThread(id);
  } catch (error) {
    if (error instanceof Error && error.message === "feedback_unavailable") {
      return (
        <AccountShell title="Anfrage" unread={await loadOwnFeedbackUnread()}>
          <p role="alert" className="hub-notice">Die Anfrage konnte nicht geladen werden. Bitte laden Sie die Seite erneut.</p>
        </AccountShell>
      );
    }
    throw error;
  }
  const unread = await loadOwnFeedbackUnread();
  return (
    <AccountShell title={loaded.thread.subject} unread={unread}>
      <FeedbackThreadView thread={loaded.thread} hint={feedbackHint(hintKey)} wasUnread={loaded.wasUnread} />
    </AccountShell>
  );
}
