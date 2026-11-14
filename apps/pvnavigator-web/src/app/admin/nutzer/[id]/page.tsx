import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminIntro, AdminLoadError, AdminUserCardView } from "@/components/admin/AdminViews";
import { getAdminUser, requireAdmin } from "@/lib/admin";
import { isAdminUserId, loadAdminUserCard, parsePage } from "@/lib/adminOverview";

export async function generateMetadata(): Promise<Metadata> {
  if (!(await getAdminUser())) return {};
  return { title: "Nutzer | Administration | PVNAVIGATOR_", robots: { index: false, follow: false } };
}

type RouteParams = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminUserPage({ params, searchParams }: RouteParams) {
  await requireAdmin();
  const { id } = await params;
  if (!isAdminUserId(id)) notFound();
  const result = await loadAdminUserCard(id, parsePage(await searchParams));
  if (result.status === "missing") notFound();

  return (
    <>
      <AdminIntro
        title="Nutzer"
        text="Gespeicherte Berechnungen dieses Kontos. Der vollständige Bericht bleibt dem Konto vorbehalten."
      />
      {result.status === "ok" ? <AdminUserCardView data={result.data} /> : <AdminLoadError />}
    </>
  );
}
