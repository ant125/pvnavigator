import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPvNavigatorUuid } from "@pv-auth/session";

import { AdminIntro, AdminLoadError } from "@/components/admin/AdminViews";
import { AdminFeedbackThreadView } from "@/components/admin/AdminFeedbackViews";
import { getAdminUser, requireAdmin } from "@/lib/admin";
import { feedbackHint } from "@/lib/feedback";
import { loadAdminFeedbackThread } from "@/lib/feedbackServer";

export async function generateMetadata(): Promise<Metadata> {
  if (!(await getAdminUser())) return {};
  return { title: "Anfrage | Administration | PVNAVIGATOR_", robots: { index: false, follow: false } };
}

type RouteParams = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hinweis?: string | string[] }>;
};

export default async function AdminFeedbackThreadPage({ params, searchParams }: RouteParams) {
  await requireAdmin();
  const { id } = await params;
  if (!isPvNavigatorUuid(id)) notFound();
  const hintParam = await searchParams;
  const hintKey = Array.isArray(hintParam.hinweis) ? hintParam.hinweis[0] : hintParam.hinweis;
  let loaded;
  try {
    loaded = await loadAdminFeedbackThread(id);
  } catch (error) {
    if (error instanceof Error && error.message === "feedback_unavailable") return <AdminLoadError />;
    throw error;
  }
  if (!loaded) notFound();
  return (
    <>
      <AdminIntro title="Feedback" text="Antworten und Status bleiben in dieser Anfrage." />
      <AdminFeedbackThreadView thread={loaded.thread} hint={feedbackHint(hintKey)} wasUnread={loaded.wasUnread} />
    </>
  );
}
