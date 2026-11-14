import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Source_Sans_3 } from "next/font/google";
import {
  AUTH_RETURN_SPEICHER,
  getHubKontoUrl,
  getHubLoginUrlForSpeicherCalculate,
  getHubSignOutUrl,
  getHubSignupUrl,
} from "@pv-auth/session";

import { SpeicherShell } from "./(speicher)/components/SpeicherShell";
import type { StoredAccountKind } from "./(speicher)/accountKind";
import { getServerUser } from "@/lib/auth";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

import "./globals.css";

const speicherSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-speicher-sans",
});

/*
  /calculate uses the mockup face. Chrome's Rendered Fonts show the v4 mockup
  drawing in locally installed Inter, which most visitors do not have, so the
  app ships Inter itself. Other routes keep Source Sans 3.
*/
const speicherUi = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-speicher-ui",
});

const speicherMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-speicher-mono",
});

export const metadata: Metadata = {
  title: "PV Speicher Rechner | PVNAVIGATOR_",
  description: "Unabhängige Wirtschaftlichkeitsanalyse für Stromspeicher.",
};

/** Header reads the shared Supabase session via cookies. */
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getServerUser();
  let profileIncomplete = false;
  let accountKind: StoredAccountKind = null;
  if (user && isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const profile = await supabase.from("profiles").select("account_kind").eq("id", user.id).maybeSingle();
    const kind = profile.data?.account_kind;
    accountKind = !profile.error && (kind === "privat" || kind === "unternehmen") ? kind : null;
    profileIncomplete = !profile.error && accountKind === null;
  }

  return (
    <html
      lang="de"
      className={`${speicherSans.variable} ${speicherUi.variable} ${speicherMono.variable}`}
    >
      <body className="font-sans antialiased">
        <SpeicherShell
          authenticated={Boolean(user)}
          userEmail={user?.email ?? null}
          loginHref={getHubLoginUrlForSpeicherCalculate()}
          signupHref={getHubSignupUrl()}
          accountHref={getHubKontoUrl()}
          signOutHref={getHubSignOutUrl({ returnTo: AUTH_RETURN_SPEICHER })}
          profileIncomplete={profileIncomplete}
          accountKind={accountKind}
        >
          {children}
        </SpeicherShell>
      </body>
    </html>
  );
}
