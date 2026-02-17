import type { Metadata } from "next";
import Link from "next/link";

/**
 * Speicher Module Layout
 *
 * This is the root layout for the Speicher-Rechner module.
 * Accessible via: speicher.pvnavigator.de
 *
 * ARCHITECTURE NOTES:
 * - This module is part of PVNavigator platform but has its own subdomain
 * - Shares authentication/billing with main app (future)
 * - No Bavaria restriction - Speicher module works globally
 * - Designed for future: subscription checks, paywall, PDF export
 */

export const metadata: Metadata = {
  title: "PV Speicher Rechner | PVNavigator",
  description:
    "Unabhängige Wirtschaftlichkeitsanalyse für Stromspeicher. Wir zeigen, ob sich ein Speicher für Ihr Haus lohnt – in Zahlen.",
  keywords: [
    "Stromspeicher",
    "Batteriespeicher",
    "PV Speicher",
    "Wirtschaftlichkeit",
    "Speicher Rechner",
    "Photovoltaik",
  ],
};

export default function SpeicherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* ========== HEADER ========== */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo / Brand */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <span className="font-semibold text-slate-100">PV Speicher</span>
                <span className="text-xs text-slate-500 ml-2">by PVNavigator</span>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden sm:flex items-center gap-6">
              <Link
                href="/"
                className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
              >
                Übersicht
              </Link>
              <Link
                href="/calculate"
                className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
              >
                Rechner
              </Link>
              {/* Future: Account, Pricing */}
            </nav>

            {/* CTA Button */}
            <Link
              href="/calculate"
              className="px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-sm font-semibold text-slate-900 transition-colors"
            >
              Speicher berechnen
            </Link>
          </div>
        </div>
      </header>

      {/* ========== MAIN CONTENT ========== */}
      <main>{children}</main>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-slate-800 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-slate-500">
              © {new Date().getFullYear()} PVNavigator. Alle Rechte vorbehalten.
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <Link href="/" className="hover:text-slate-300 transition-colors">
                pvnavigator.de
              </Link>
              <span className="text-slate-700">•</span>
              <span>Unabhängige PV-Analyse</span>
              <span className="text-slate-700">•</span>
              <Link
                href="/technische-details"
                className="hover:text-slate-300 transition-colors"
              >
                Technische Details zur Berechnung
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

