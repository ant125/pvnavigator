import type { Metadata } from "next";

import { AuthEnvMissing } from "@/components/auth/AuthEnvMissing";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { parseAuthNextParam, signUpErrorFromQuery } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Konto erstellen | PVNAVIGATOR_",
  description: "PVNAVIGATOR_-Konto mit E-Mail und Passwort erstellen.",
};

type SearchParams = Promise<{ error?: string | string[]; check?: string | string[]; next?: string | string[] }>;

export default async function KontoErstellenPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const configured = isSupabaseConfigured();
  const sp = await searchParams;
  const error = signUpErrorFromQuery(Array.isArray(sp.error) ? sp.error[0] : sp.error);
  const check = Array.isArray(sp.check) ? sp.check[0] : sp.check;
  const needsConfirmation = check === "email";
  const nextPath = parseAuthNextParam(Array.isArray(sp.next) ? sp.next[0] : sp.next, "/konto");

  return (
    <AuthShell
      title="Konto erstellen"
      subtitle="Erstellen Sie ein PVNAVIGATOR_-Konto mit E-Mail und Passwort."
    >
      {!configured ? (
        <AuthEnvMissing />
      ) : (
        <SignUpForm error={error} needsConfirmation={needsConfirmation} nextPath={nextPath} />
      )}
    </AuthShell>
  );
}
