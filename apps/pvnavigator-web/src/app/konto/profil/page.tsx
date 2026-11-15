import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountShell, AccountUnavailable } from "@/components/account/AccountShell";
import { ProfilePanel } from "@/components/account/ProfilePanel";
import { getServerUser } from "@/lib/auth";
import { loadAccountProfile } from "@/lib/accountWorkspace";
import { loadOwnFeedbackUnread } from "@/lib/feedbackServer";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Persönliche Daten | Mein Konto | PVNAVIGATOR_",
  description: "Profil des PVNAVIGATOR_-Kontos.",
};

type SearchParams = Promise<{ profil?: string | string[] }>;

export default async function ProfilPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isSupabaseConfigured()) return <AccountUnavailable />;
  const user = await getServerUser();
  if (!user?.email) redirect("/anmelden?next=/konto/profil");

  const hintParam = await searchParams;
  const profileKey = Array.isArray(hintParam.profil) ? hintParam.profil[0] : hintParam.profil;
  const profileStatus = profileKey === "gespeichert" ? "saved" : profileKey === "ungueltig" ? "invalid" : null;
  const [profile, unread] = await Promise.all([
    loadAccountProfile(user.id),
    loadOwnFeedbackUnread(),
  ]);

  return (
    <AccountShell
      title="Persönliche Daten"
      subtitle="Name, Kontoart und E-Mail Ihres PVNAVIGATOR_-Kontos."
      unread={unread}
    >
      <ProfilePanel email={user.email} profile={profile} status={profileStatus} />
    </AccountShell>
  );
}
