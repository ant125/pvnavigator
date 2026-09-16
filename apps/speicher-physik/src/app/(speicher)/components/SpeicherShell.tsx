"use client";

import Link from "next/link";
import { BatteryMedium } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { HeaderAccount, type HeaderAccountProps } from "./HeaderAccount";
import { useHeaderCtaState, HeaderCtaProvider } from "./headerCtaContext";

const btnEnergy =
  "inline-flex items-center justify-center bg-accent hover:bg-accent-hover text-white font-semibold transition-colors duration-200";

/** Desktop-only: on 320–430px the CTA collides with account controls, and /calculate + /result already have in-flow actions. */
const headerCtaClass = `${btnEnergy} max-md:hidden shrink-0 whitespace-nowrap rounded-sm px-4 py-2.5 text-center text-sm leading-none sm:py-2 sm:leading-normal`;

const footerLink =
  "inline-flex min-h-11 items-center text-sm text-ink-secondary transition-colors hover:text-ink hover:underline hover:underline-offset-2 md:min-h-0";

const footerLinkActive =
  "inline-flex min-h-11 items-center text-sm font-medium text-ink md:min-h-0";

function footerLinkClass(active: boolean) {
  return active ? footerLinkActive : footerLink;
}

function BrandMark() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent">
      <BatteryMedium className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
    </div>
  );
}

function HeaderWordmark() {
  return (
    <span className="flex min-w-0 items-baseline whitespace-nowrap font-mono text-[11px] font-medium leading-none tracking-[0.16em] text-ink sm:text-xs sm:tracking-[0.18em]">
      <span>PVNAVIGATOR_</span>
      <span className="mx-1.5 font-normal tracking-normal text-ink-muted" aria-hidden>
        /
      </span>
      <span>SPEICHERGRENZE</span>
    </span>
  );
}

function HeaderCta() {
  const pathname = usePathname();
  const { reportActive, resetRef } = useHeaderCtaState();
  const isCalculateRoute = pathname === "/calculate";
  const isResultRoute =
    pathname === "/result" || pathname.startsWith("/result/");
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

  if (isCalculateRoute) {
    return null;
  }

  return (
    <Link href="/calculate" className={headerCtaClass}>
      Speicher berechnen
    </Link>
  );
}

type ShellFrameProps = Omit<HeaderAccountProps, "compact"> & {
  children: ReactNode;
};

function ShellFrame({
  children,
  authenticated,
  userEmail,
  loginHref,
  signupHref,
  accountHref,
  signOutHref,
}: ShellFrameProps) {
  const pathname = usePathname();
  const isCalculateRoute = pathname === "/calculate";
  const methodikActive =
    pathname === "/methodik" ||
    (pathname.startsWith("/methodik/") && pathname !== "/methodik/referenz");

  const headerNav = (
    <>
      <Link
        href="/"
        className="flex min-w-0 items-center"
        aria-label="PVNavigator SpeicherGrenze"
      >
        <HeaderWordmark />
      </Link>

      <div
        className={
          isCalculateRoute
            ? "flex min-w-0 shrink-0 items-center justify-end"
            : "flex min-w-0 w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:gap-4"
        }
      >
        <HeaderAccount
          authenticated={authenticated}
          userEmail={userEmail}
          loginHref={loginHref}
          signupHref={signupHref}
          accountHref={accountHref}
          signOutHref={signOutHref}
          compact={isCalculateRoute}
        />
        <HeaderCta />
      </div>
    </>
  );

  const footerBody = (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-16">
      <div className="max-w-sm">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <BrandMark />
          <span className="font-semibold text-ink">SpeicherGrenze</span>
        </Link>
        <div className="mt-1.5 md:mt-0 md:pl-[2.625rem]">
          <Link
            href="https://pvnavigator.de"
            rel="noopener noreferrer"
            className="block text-xs text-ink-muted transition-colors hover:text-ink hover:underline hover:underline-offset-2 md:mt-0.5"
          >
            by PVNavigator
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-ink-secondary md:mt-3">
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
        className="border-t border-line-soft pt-6 md:border-t-0 md:pt-1"
      >
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          Unterlagen
        </p>
        <ul className="mt-2 flex flex-col md:mt-3 md:gap-2.5">
          <li>
            <Link href="/methodik" className={footerLinkClass(methodikActive)}>
              Methodik
            </Link>
          </li>
          <li>
            <Link
              href="/methodik/referenz"
              className={footerLinkClass(pathname === "/methodik/referenz")}
            >
              Referenz
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );

  const shell = (
    <>
      <header
        className={
          isCalculateRoute
            ? "sticky top-0 z-50 border-b border-line bg-canvas"
            : "sticky top-0 z-50 bg-canvas"
        }
      >
        <div
          className={
            isCalculateRoute
              ? "flex min-w-0 items-center justify-between gap-3 px-layout-gap py-2"
              : "mx-auto w-full min-w-0 max-w-frame px-4 sm:px-6 lg:px-8"
          }
        >
          {isCalculateRoute ? (
            headerNav
          ) : (
            <div className="flex min-w-0 flex-col gap-2 border-b border-line py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-2.5">
              {headerNav}
            </div>
          )}
        </div>
      </header>

      <main className="min-w-0 flex-1">{children}</main>

      <footer
        className={
          isCalculateRoute
            ? "min-w-0 border-t border-line bg-canvas"
            : "min-w-0 border-t border-line bg-surface"
        }
      >
        <div
          className={
            isCalculateRoute
              ? "px-layout-gap py-4"
              : "mx-auto w-full min-w-0 max-w-frame px-4 py-8 sm:px-6 md:pt-10 md:pb-8 lg:px-8"
          }
        >
          {footerBody}
        </div>
      </footer>
    </>
  );

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-canvas text-ink">
      {isCalculateRoute ? (
        <div className="mx-auto flex min-h-screen w-full min-w-0 max-w-frame flex-col px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border border-line-strong bg-canvas">
            {shell}
          </div>
        </div>
      ) : (
        shell
      )}
    </div>
  );
}

export function SpeicherShell({
  children,
  authenticated,
  userEmail,
  loginHref,
  signupHref,
  accountHref,
  signOutHref,
}: ShellFrameProps) {
  return (
    <HeaderCtaProvider>
      <ShellFrame
        authenticated={authenticated}
        userEmail={userEmail}
        loginHref={loginHref}
        signupHref={signupHref}
        accountHref={accountHref}
        signOutHref={signOutHref}
      >
        {children}
      </ShellFrame>
    </HeaderCtaProvider>
  );
}
