import type { Metadata } from "next";

import { AdminIntro, AdminLoadError, AdminUserListView } from "@/components/admin/AdminViews";
import { getAdminUser, requireAdmin } from "@/lib/admin";
import { loadAdminUserList, parseUserListQuery } from "@/lib/adminOverview";

export async function generateMetadata(): Promise<Metadata> {
  if (!(await getAdminUser())) return {};
  return { title: "Nutzer | Administration | PVNAVIGATOR_", robots: { index: false, follow: false } };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const query = parseUserListQuery(await searchParams);
  const result = await loadAdminUserList(query);

  return (
    <>
      <AdminIntro
        title="Nutzer"
        text="Registrierte Konten von PVNAVIGATOR_. Der Kontotyp ist noch nicht gespeichert."
      />
      {result.status === "ok" ? <AdminUserListView query={query} data={result.data} /> : <AdminLoadError />}
    </>
  );
}
