"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Speicher Module Header
 * 
 * Client component that adapts the CTA button based on current route:
 * - On /speicher/result: "Annahmen ändern" → /speicher/calculate
 * - Elsewhere: "Speicher berechnen" → /speicher/calculate
 */
export function SpeicherHeader() {
  const pathname = usePathname();
  const isResultPage = pathname === "/speicher/result";

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo / Brand */}
          <Link href="/speicher" className="flex items-center gap-2">
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
              href="/speicher"
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Übersicht
            </Link>
            <Link
              href="/speicher/calculate"
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Rechner
            </Link>
            {/* Future: Account, Pricing */}
          </nav>

          {/* CTA Button - dynamic based on route */}
          <Link
            href="/speicher/calculate"
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              isResultPage
                ? "bg-slate-700 hover:bg-slate-600 text-slate-100"
                : "bg-amber-500 hover:bg-amber-400 text-slate-900"
            }`}
          >
            {isResultPage ? "Annahmen ändern" : "Speicher berechnen"}
          </Link>
        </div>
      </div>
    </header>
  );
}


