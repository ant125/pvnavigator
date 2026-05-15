import type { Metadata } from "next";

import { AuthEnvMissing } from "@/components/auth/AuthEnvMissing";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Konto erstellen | PVNavigator",
  description: "PVNavigator-Konto mit E-Mail und Passwort erstellen.",
};

export default function KontoErstellenPage() {
  const configured = isSupabaseConfigured();

  return (
    <AuthShell
      title="Konto erstellen"
      subtitle="Erstellen Sie ein PVNavigator-Konto mit E-Mail und Passwort."
    >
      {!configured ? (
        <AuthEnvMissing />
      ) : (
        <SignUpForm />
      )}
    </AuthShell>
  );
}
