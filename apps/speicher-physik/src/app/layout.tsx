import type { Metadata } from "next";
import {
  getHubKontoUrl,
  getHubLoginUrlForSpeicherCalculate,
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
          loginHref={getHubLoginUrlForSpeicherCalculate()}
          signupHref={getHubSignupUrl()}
          accountHref={getHubKontoUrl()}
        >
          {children}
        </SpeicherShell>
      </body>
    </html>
  );
}
