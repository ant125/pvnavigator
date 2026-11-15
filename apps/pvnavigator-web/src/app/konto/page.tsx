import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSpeicherGrenzeCalculateUrl } from "@pv-auth/session";

import { AccountOverview } from "@/components/account/AccountOverview";
import { AccountShell, AccountUnavailable } from "@/components/account/AccountShell";
import { LegacyKontoRedirect } from "@/components/account/LegacyKontoRedirect";
import { INVOICE_HISTORY_HINTS } from "@/lib/billing/invoicePortal";
import { getServerUser } from "@/lib/auth";
import { loadAccountWorkspace } from "@/lib/accountWorkspace";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mein Konto | PVNAVIGATOR_",
  description: "PVNAVIGATOR_-Konto: Berechnungen und Werkzeuge verwalten.",
};

type SearchParams = Promise<{ hinweis?: string | string[]; profil?: string | string[] }>;

export default async function KontoPage({ searchParams }: { searchParams: SearchParams }) {
  const hintParam = await searchParams;
  const hintKey = Array.isArray(hintParam.hinweis) ? hintParam.hinweis[0] : hintParam.hinweis;
  const profileKey = Array.isArray(hintParam.profil) ? hintParam.profil[0] : hintParam.profil;
  const invoiceHint = hintKey ? INVOICE_HISTORY_HINTS[hintKey] : undefined;

  if (!isSupabaseConfigured()) return <AccountUnavailable />;

  const user = await getServerUser();
  if (!user?.email) redirect("/anmelden?next=/konto");
  if (profileKey === "gespeichert" || profileKey === "ungueltig") {
    redirect(`/konto/profil?profil=${profileKey}`);
  }

  const workspace = await loadAccountWorkspace(user.id);
  const calculateUrl = getSpeicherGrenzeCalculateUrl();

  return (
    <AccountShell
      title="Übersicht"
      subtitle="Ihre Berechnungen, Ihr Zugang und Ihre Anfragen."
      unread={workspace.feedbackUnread}
    >
      <LegacyKontoRedirect />
      <AccountOverview
        calculations={workspace.calculations}
        hasInvoices={workspace.hasInvoices}
        invoiceHint={invoiceHint}
        calculateUrl={calculateUrl}
        loadError={workspace.loadError}
        isAdmin={workspace.isAdmin}
        feedbackThreads={workspace.feedbackThreads}
        feedbackUnread={workspace.feedbackUnread}
        feedbackError={workspace.feedbackError}
      />
    </AccountShell>
  );
}
