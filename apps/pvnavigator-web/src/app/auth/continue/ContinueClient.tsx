"use client";

import { useEffect } from "react";
import { rehomeReadableAuthCookiesInBrowser } from "@pv-auth/session";

import { AuthShell } from "@/components/auth/AuthShell";

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98]";

export function ContinueClient({ dest }: { dest: string }) {
  useEffect(() => {
    rehomeReadableAuthCookiesInBrowser();

    const key = `pv-auth-continue:${dest}`;
    try {
      const prev = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - prev < 4000) {
        return;
      }
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // Ignore sessionStorage failures and still navigate.
    }
    window.location.replace(dest);
  }, [dest]);

  return (
    <AuthShell
      title="Weiterleitung"
      subtitle="Sie werden zu SpeicherGrenze weitergeleitet. Falls nichts passiert, nutzen Sie den Button."
    >
      <a
        href={dest}
        className={primaryBtn}
        onClick={() => {
          rehomeReadableAuthCookiesInBrowser();
        }}
      >
        Weiter
      </a>
    </AuthShell>
  );
}
