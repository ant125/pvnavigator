"use client";

import Link from "next/link";
import { BatteryMedium } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const btnEnergy =
  "inline-flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 active:scale-[0.98] transition-all duration-200 hover:scale-[1.03] shadow-[0_0_0_rgba(0,0,0,0)] hover:shadow-[0_0_20px_rgba(34,197,94,0.25)] text-white font-semibold";

export function SpeicherShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isSimplifiedNav =
    pathname === "/" ||
    pathname === "/calculate" ||
    pathname?.startsWith("/calculate/");

  return (
    <div className="min-h-screen bg-[#0B0F14] text-slate-50">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0B0F14]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-6">
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial sm:min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center">
                <BatteryMedium className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 leading-snug sm:flex-row sm:items-baseline sm:gap-x-2 sm:gap-y-0 sm:leading-normal">
                <span className="font-semibold leading-tight text-white sm:leading-normal">
                  {isSimplifiedNav ? "SpeicherGrenze" : "PV Speicher"}
                </span>
                <span className="text-xs leading-none text-white/50 whitespace-nowrap sm:leading-normal">
                  by PVNavigator
                </span>
              </div>
            </Link>

            {!isSimplifiedNav ? (
              <nav className="hidden sm:flex items-center gap-6">
                <Link
                  href="/"
                  className="text-sm text-white/50 hover:text-white transition-colors"
                >
                  Übersicht
                </Link>
                <Link
                  href="/calculate"
                  className="text-sm text-white/50 hover:text-white transition-colors"
                >
                  Rechner
                </Link>
              </nav>
            ) : null}

            <Link
              href="/calculate"
              className={`${btnEnergy} shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-center text-sm leading-none sm:py-2 sm:leading-normal`}
            >
              Speicher berechnen
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-white/5 py-6 mt-auto bg-[#0B0F14]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link
              href="https://pvnavigator.de"
              className="text-slate-300 hover:text-white transition-colors"
            >
              PVNavigator.de
            </Link>
            <Link
              href="/technische-details"
              className="text-slate-300 hover:text-white transition-colors sm:text-right"
            >
              Technische Details zur Berechnung
            </Link>
          </div>
          <div className="text-xs text-slate-500 text-center mt-4 space-y-1">
            <p>Basierend auf 8760h Simulation</p>
            <p>Physikalisches Modell ohne Verkaufslogik</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
