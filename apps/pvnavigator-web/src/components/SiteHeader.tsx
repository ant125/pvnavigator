"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const navItems = [
  { href: "/#werkzeuge", label: "Tools" },
  { href: "/#warum-pvnavigator", label: "Über das Projekt" },
] as const;

const primaryBtn =
  "inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98]";

const ghostBtn =
  "inline-flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[#0F172A] shadow-sm transition hover:bg-[#FAFBFC]";

const navMuted = "text-sm font-medium text-[#64748B] transition-colors hover:text-[#0F172A]";

type SiteHeaderProps = {
  userEmail: string | null;
  logoutAction: () => Promise<void>;
};

export function SiteHeader({ userEmail, logoutAction }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const authenticated = Boolean(userEmail);

  return (
    <header className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setMenuOpen(false)}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 shadow-sm">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <span className="font-semibold tracking-tight text-[#0F172A]">PVNavigator</span>
        </Link>

        <nav className="hidden flex-1 justify-center md:flex" aria-label="Hauptnavigation">
          <div className="flex items-center gap-8">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={navMuted}>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="hidden shrink-0 items-center gap-3 md:flex">
          {authenticated ? (
            <>
              <Link href="/konto" className={navMuted}>
                Mein Konto
              </Link>
              {userEmail ? (
                <span
                  className="hidden max-w-[11rem] truncate text-xs text-[#94a3b8] lg:inline"
                  title={userEmail}
                >
                  {userEmail}
                </span>
              ) : null}
              <form action={logoutAction}>
                <button type="submit" className={ghostBtn}>
                  Abmelden
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/anmelden" className={navMuted}>
                Anmelden
              </Link>
              <Link href="/konto-erstellen" className={primaryBtn}>
                Konto erstellen
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] shadow-sm md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
        </button>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-nav"
          className="border-t border-[#E2E8F0] bg-white px-4 py-4 md:hidden"
          aria-label="Mobile Navigation"
        >
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-lg px-3 py-3 text-sm font-medium text-[#0F172A] hover:bg-[#FAFBFC]"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-[#E2E8F0] pt-3">
            {authenticated ? (
              <div className="flex flex-col gap-2">
                {userEmail ? (
                  <p className="truncate px-3 text-xs text-[#94a3b8]" title={userEmail}>
                    {userEmail}
                  </p>
                ) : null}
                <Link
                  href="/konto"
                  className="block rounded-lg px-3 py-3 text-sm font-medium text-[#0F172A] hover:bg-[#FAFBFC]"
                  onClick={() => setMenuOpen(false)}
                >
                  Mein Konto
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className={`${ghostBtn} w-full`}
                    onClick={() => setMenuOpen(false)}
                  >
                    Abmelden
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/anmelden"
                  className="block rounded-lg px-3 py-3 text-sm font-medium text-[#0F172A] hover:bg-[#FAFBFC]"
                  onClick={() => setMenuOpen(false)}
                >
                  Anmelden
                </Link>
                <Link href="/konto-erstellen" className={`${primaryBtn} mx-3 justify-center`} onClick={() => setMenuOpen(false)}>
                  Konto erstellen
                </Link>
              </div>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
