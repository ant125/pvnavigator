import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSpeicherGrenzeCalculateUrl } from "@pv-auth/session";

import { AccountCalculations } from "@/components/account/AccountCalculations";
import { AccountShell, AccountUnavailable } from "@/components/account/AccountShell";
import { getServerUser } from "@/lib/auth";
import { loadAccountWorkspace } from "@/lib/accountWorkspace";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Meine Berechnungen | Mein Konto | PVNAVIGATOR_",
  description: "Gespeicherte PVNAVIGATOR_-Berechnungen und Berichte.",
};

export default async function BerechnungenPage() {
  if (!isSupabaseConfigured()) return <AccountUnavailable />;
  const user = await getServerUser();
  if (!user?.email) redirect("/anmelden?next=/konto/berechnungen");

  const workspace = await loadAccountWorkspace(user.id);
  return (
    <AccountShell
      title="Meine Berechnungen"
      unread={workspace.feedbackUnread}
      actions={<a href={getSpeicherGrenzeCalculateUrl()} className="hub-primary">Neue Berechnung <span aria-hidden="true">↗</span></a>}
    >
      <AccountCalculations
        calculations={workspace.calculations}
        calculateUrl={getSpeicherGrenzeCalculateUrl()}
        loadError={workspace.loadError}
        trustpilotShow={workspace.trustpilotShow}
        trustpilotRecordShown={workspace.trustpilotRecordShown}
      />
    </AccountShell>
  );
}
