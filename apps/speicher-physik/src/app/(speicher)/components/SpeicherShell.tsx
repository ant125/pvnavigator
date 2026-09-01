"use client";

import Link from "next/link";
import { BatteryMedium } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { HeaderCtaProvider, useHeaderCtaState } from "./headerCtaContext";

const btnEnergy =
  "inline-flex items-center justify-center bg-accent hover:bg-accent-hover text-white font-semibold transition-colors duration-200";

const headerCtaClass = `${btnEnergy} shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-center text-sm leading-none sm:py-2 sm:leading-normal`;

const footerLink =
  "text-sm text-ink-secondary transition-colors hover:text-ink hover:underline hover:underline-offset-2";

function footerLinkClass(active: boolean) {
  return active ? "text-sm font-medium text-ink" : footerLink;
}

function BrandMark() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
      <BatteryMedium className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
    </div>
  );
}

function HeaderCta() {
  const pathname = usePathname();
  const { reportActive, resetRef } = useHeaderCtaState();
  const isResultRoute = pathname === "/result";
  const showNewCalculation = isResultRoute || reportActive;

  if (showNewCalculation) {
    if (isResultRoute) {
      return (
        <Link href="/calculate" className={headerCtaClass}>
          Neue Berechnung
        </Link>
      );
    }
    return (
      <button
        type="button"
        className={headerCtaClass}
        onClick={() => resetRef?.current?.()}
      >
        Neue Berechnung
      </button>
    );
  }

  return (
    <Link href="/calculate" className={headerCtaClass}>
      Speicher berechnen
    </Link>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-50 border-b border-line bg-surface">
        <div className="max-w-frame mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-6">
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial sm:min-w-0">
              <BrandMark />
              <div className="flex min-w-0 flex-col gap-0.5 leading-snug sm:flex-row sm:items-baseline sm:gap-x-2 sm:gap-y-0 sm:leading-normal">
                <span className="font-semibold leading-tight text-ink sm:leading-normal">
                  SpeicherGrenze
                </span>
                <span className="text-xs leading-none text-ink-muted whitespace-nowrap sm:leading-normal">
                  by PVNavigator
                </span>
              </div>
            </Link>

            <HeaderCta />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="max-w-frame mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between md:gap-16">
            <div className="max-w-sm">
              <Link href="/" className="inline-flex items-center gap-2.5">
                <BrandMark />
                <span className="font-semibold text-ink">SpeicherGrenze</span>
              </Link>
              <div className="pl-[2.625rem]">
                <Link
                  href="https://pvnavigator.de"
                  rel="noopener noreferrer"
                  className="mt-0.5 block text-xs text-ink-muted transition-colors hover:text-ink hover:underline hover:underline-offset-2"
                >
                  by PVNavigator
                </Link>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  15-Minuten-Zeitschritte
                  <br />
                  15 Wetterjahre
                  <br />
                  Validierung mit 27 Referenzhaushalten
                </p>
              </div>
            </div>

            <nav
              aria-label="Unterlagen"
              className="border-t border-line-soft pt-8 md:border-t-0 md:pt-1"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Unterlagen
              </p>
              <ul className="mt-3 flex flex-col gap-2.5">
                <li>
                  <Link
                    href="/methodik-quellen"
                    className={footerLinkClass(pathname === "/methodik-quellen")}
                  >
                    Methodik
                  </Link>
                </li>
                <li>
                  <Link
                    href="/technische-details"
                    className={footerLinkClass(
                      pathname === "/technische-details",
                    )}
                  >
                    Technische Details zur Berechnung
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function SpeicherShell({ children }: { children: ReactNode }) {
  return (
    <HeaderCtaProvider>
      <ShellFrame>{children}</ShellFrame>
    </HeaderCtaProvider>
  );
}
