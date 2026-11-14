import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Inter } from "next/font/google";

import { SiteHeader } from "@/components/SiteHeader";
import { accountProfileFromRow, profileNeedsCompletion } from "@/lib/accountProfile";
import { getServerUser } from "@/lib/auth";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const hubMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-hub-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PVNAVIGATOR_ – Intelligente Photovoltaik-Analyse",
  description:
    "Speicheroptimierung, Wirtschaftlichkeitsanalyse und Dachbewertung — verständlich, unabhängig und datenbasiert.",
};

/** Header reads Supabase session via cookies — avoid static caching for wrong auth UI. */
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getServerUser();
  let profilePrompt = false;
  if (user && isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const profile = await supabase.from("profiles").select("account_kind, given_name, family_name, company_name").eq("id", user.id).maybeSingle();
    profilePrompt = !profile.error && profileNeedsCompletion(accountProfileFromRow(profile.data));
  }

  return (
    <html lang="de">
      <body className={`${inter.variable} ${hubMono.variable} antialiased bg-[#FAFBFC] text-[#0F172A]`}>
        <div className="flex min-h-screen flex-col">
          <SiteHeader userEmail={user?.email ?? null} />
          <main className="flex-1">
            {profilePrompt ? (
              <div className="mx-auto w-full max-w-[1120px] px-4 pt-4">
                <p role="status" className="hub-notice">
                  Bitte ergänzen Sie Ihr Profil. Ihre Berechnungen bleiben verfügbar.{" "}
                  <Link href="/konto#profil" className="font-semibold text-[#36533c] underline">Profil ausfüllen</Link>
                </p>
              </div>
            ) : null}
            {children}
          </main>
          <footer className="border-t border-[#E2E8F0] bg-white">
            <div className="mx-auto max-w-[1120px] px-4 py-5">
              <p className="text-center text-[13px] text-[#64748B] sm:text-left">
                Ein unabhängiges PV-Projekt.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:mt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-xs text-[#94a3b8] sm:text-left">
                  © {new Date().getFullYear()} PVNAVIGATOR_
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-[#64748B] sm:justify-end">
                  <Link href="/impressum" className="transition-colors hover:text-[#0F172A]">
                    Impressum
                  </Link>
                  <Link href="/datenschutz" className="transition-colors hover:text-[#0F172A]">
                    Datenschutz
                  </Link>
                  <Link href="/kontakt" className="transition-colors hover:text-[#0F172A]">
                    Kontakt
                  </Link>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
