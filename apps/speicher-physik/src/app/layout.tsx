import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
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

const speicherSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-speicher-sans",
});

const speicherMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-speicher-mono",
});

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
    <html lang="de" className={`${speicherSans.variable} ${speicherMono.variable}`}>
      <body className="font-sans antialiased">
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
