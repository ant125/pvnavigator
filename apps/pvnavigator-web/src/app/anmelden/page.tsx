import type { Metadata } from "next";

import { sanitizeNextPath } from "@/lib/auth";
import { AuthEnvMissing } from "@/components/auth/AuthEnvMissing";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Anmelden | PVNavigator",
  description: "Bei PVNavigator mit E-Mail und Passwort anmelden.",
};

type SearchParams = Promise<{ next?: string | string[] }>;

export default async function AnmeldenPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const nextPath = sanitizeNextPath(rawNext, "/konto");
  const configured = isSupabaseConfigured();

  return (
    <AuthShell title="Anmelden" subtitle="Melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an.">
      {!configured ? (
        <AuthEnvMissing />
      ) : (
        <SignInForm nextPath={nextPath} />
      )}
    </AuthShell>
  );
}
