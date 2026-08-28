"use client";

import Link from "next/link";
import { BatteryMedium } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const btnEnergy =
  "inline-flex items-center justify-center bg-accent hover:bg-accent-hover text-white font-semibold transition-colors duration-200";

export function SpeicherShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isSimplifiedNav =
    pathname === "/" ||
    pathname === "/calculate" ||
    pathname?.startsWith("/calculate/");

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-50 border-b border-line bg-surface">
        <div className="max-w-frame mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-6">
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial sm:min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-accent flex items-center justify-center">
                <BatteryMedium className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 leading-snug sm:flex-row sm:items-baseline sm:gap-x-2 sm:gap-y-0 sm:leading-normal">
                <span className="font-semibold leading-tight text-ink sm:leading-normal">
                  {isSimplifiedNav ? "SpeicherGrenze" : "PV Speicher"}
                </span>
                <span className="text-xs leading-none text-ink-muted whitespace-nowrap sm:leading-normal">
                  by PVNavigator
                </span>
              </div>
            </Link>

            {!isSimplifiedNav ? (
              <nav className="hidden sm:flex items-center gap-6">
                <Link
                  href="/"
                  className="text-sm text-ink-secondary hover:text-ink transition-colors"
                >
                  Übersicht
                </Link>
                <Link
                  href="/calculate"
                  className="text-sm text-ink-secondary hover:text-ink transition-colors"
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

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line py-6 bg-surface">
        <div className="max-w-frame mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link
              href="https://pvnavigator.de"
              className="text-ink-secondary hover:text-ink transition-colors"
            >
              PVNavigator.de
            </Link>
            <Link
              href="/technische-details"
              className="text-ink-secondary hover:text-ink transition-colors sm:text-right"
            >
              Technische Details zur Berechnung
            </Link>
          </div>
          <div className="text-xs text-ink-muted text-center mt-4 space-y-1">
            <p>Basierend auf 8760h Simulation</p>
            <p>Physikalisches Modell ohne Verkaufslogik</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
