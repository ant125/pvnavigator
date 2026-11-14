import type { Metadata } from "next";

import { AdminNav } from "@/components/admin/AdminNav";
import { getAdminUser, requireAdmin } from "@/lib/admin";
import { loadAdminFeedbackUnread } from "@/lib/feedbackServer";

// Next.js emits metadata even when the layout answers 404, so the title is
// only set for an administrator.
export async function generateMetadata(): Promise<Metadata> {
  if (!(await getAdminUser())) return {};
  return {
    title: "Administration | PVNAVIGATOR_",
    robots: { index: false, follow: false },
  };
}

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();
  const unreadFeedback = await loadAdminFeedbackUnread();
  return (
    <div className="hub-workspace">
      <AdminNav unreadFeedback={unreadFeedback} />
      {children}
    </div>
  );
}
