import type { Metadata } from "next";
import {
  AUTH_RETURN_SPEICHER,
  getHubKontoUrl,
  getHubLoginUrlForSpeicherCalculate,
  getHubSignOutUrl,
  getHubSignupUrl,
} from "@pv-auth/session";

import { SpeicherShell } from "./(speicher)/components/SpeicherShell";
import { getServerUser } from "@/lib/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "PV Speicher Rechner | PVNavigator",
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

  return (
    <html lang="de">
      <body className="antialiased">
        <SpeicherShell
          authenticated={Boolean(user)}
          userEmail={user?.email ?? null}
          loginHref={getHubLoginUrlForSpeicherCalculate()}
          signupHref={getHubSignupUrl()}
          accountHref={getHubKontoUrl()}
          signOutHref={getHubSignOutUrl({ returnTo: AUTH_RETURN_SPEICHER })}
        >
          {children}
        </SpeicherShell>
      </body>
    </html>
  );
}
