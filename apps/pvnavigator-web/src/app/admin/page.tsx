import { AdminDashboardView, AdminIntro, AdminLoadError } from "@/components/admin/AdminViews";
import { loadAdminDashboard } from "@/lib/adminOverview";
import { requireAdmin } from "@/lib/admin";

export default async function AdminPage() {
  await requireAdmin();
  const result = await loadAdminDashboard();

  return (
    <>
      <AdminIntro
        title="Administration"
        text="Nutzer und gespeicherte Berechnungen von PVNAVIGATOR_."
      />
      {result.status === "ok" ? <AdminDashboardView data={result.data} /> : <AdminLoadError />}
    </>
  );
}
