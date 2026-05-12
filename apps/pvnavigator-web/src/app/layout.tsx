import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { SiteHeader } from "../components/SiteHeader";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PVNavigator – Intelligente Photovoltaik-Analyse",
  description:
    "Speicheroptimierung, Wirtschaftlichkeitsanalyse und Dachbewertung — verständlich, unabhängig und datenbasiert.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${inter.variable} antialiased bg-[#FAFBFC] text-[#0F172A]`}>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[#E2E8F0] bg-white">
            <div className="mx-auto max-w-6xl px-4 py-5">
              <p className="text-center text-[13px] text-[#64748B] sm:text-left">
                Ein unabhängiges PV-Projekt.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:mt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-xs text-[#94a3b8] sm:text-left">
                  © {new Date().getFullYear()} PVNavigator
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-[#64748B] sm:justify-end">
                  <Link href="/impressum" className="transition-colors hover:text-[#0F172A]">
                    Impressum
                  </Link>
                  <Link href="/datenschutz" className="transition-colors hover:text-[#0F172A]">
                    Datenschutz
                  </Link>
                  <a
                    href="https://www.youtube.com/@YOUR_CHANNEL"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[#0F172A]"
                  >
                    YouTube
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
