import type { Metadata } from "next";

import { AdminIntro, AdminLoadError } from "@/components/admin/AdminViews";
import { AdminFeedbackListView } from "@/components/admin/AdminFeedbackViews";
import { getAdminUser, requireAdmin } from "@/lib/admin";
import { parsePage } from "@/lib/adminOverview";
import { loadAdminFeedbackList } from "@/lib/feedbackServer";

export async function generateMetadata(): Promise<Metadata> {
  if (!(await getAdminUser())) return {};
  return { title: "Feedback | Administration | PVNAVIGATOR_", robots: { index: false, follow: false } };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminFeedbackPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const result = await loadAdminFeedbackList(parsePage(await searchParams));
  return (
    <>
      <AdminIntro
        title="Feedback"
        text="Anfragen der Konten von PVNAVIGATOR_. Der vollständige Bericht bleibt dem Konto vorbehalten."
      />
      {result.status === "ok" ? <AdminFeedbackListView data={result.data} /> : <AdminLoadError />}
    </>
  );
}
