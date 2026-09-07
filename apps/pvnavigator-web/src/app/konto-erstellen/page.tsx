import type { Metadata } from "next";

import { AuthEnvMissing } from "@/components/auth/AuthEnvMissing";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { signUpErrorFromQuery } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Konto erstellen | PVNavigator",
  description: "PVNavigator-Konto mit E-Mail und Passwort erstellen.",
};

type SearchParams = Promise<{ error?: string | string[]; check?: string | string[] }>;

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

  return (
    <AuthShell
      title="Konto erstellen"
      subtitle="Erstellen Sie ein PVNavigator-Konto mit E-Mail und Passwort."
    >
      {!configured ? (
        <AuthEnvMissing />
      ) : (
        <SignUpForm error={error} needsConfirmation={needsConfirmation} />
      )}
    </AuthShell>
  );
}
