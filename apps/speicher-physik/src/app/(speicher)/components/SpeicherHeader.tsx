"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SpeicherGrenzeLogo } from "@/components/branding/SpeicherGrenzeLogo";

/**
 * SpeicherGrenze module header.
 *
 * Client component that adapts the CTA button based on current route:
 * - On /speicher/result: "Annahmen ändern" → /speicher/calculate
 * - Elsewhere: "Speicher berechnen" → /speicher/calculate
 */
export function SpeicherHeader() {
  const pathname = usePathname();
  const isResultPage = pathname === "/result";

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-2">
            <SpeicherGrenzeLogo />
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

          {/* CTA Button - dynamic based on route */}
          <Link
            href="/calculate"
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              isResultPage
                ? "bg-slate-700 hover:bg-slate-600 text-slate-100"
                : "inline-flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 active:scale-[0.98] hover:scale-[1.03] shadow-[0_0_0_rgba(0,0,0,0)] hover:shadow-[0_0_20px_rgba(34,197,94,0.25)] text-white transition-all duration-200"
            }`}
          >
            {isResultPage ? "Annahmen ändern" : "Speicher berechnen"}
          </Link>
        </div>
      </div>
    </header>
  );
}


