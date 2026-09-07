"use client";

import { useEffect } from "react";

import { handoffSessionToSpeicherGrenze } from "@/lib/auth/handoffSession";
import { AuthShell } from "@/components/auth/AuthShell";

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98]";

export function ContinueClient({ dest }: { dest: string }) {
  useEffect(() => {
    const key = `pv-auth-continue:${dest}`;
    let bounced = false;
    try {
      const prev = Number(sessionStorage.getItem(key) || 0);
      bounced = Date.now() - prev < 4000;
      if (!bounced) {
        sessionStorage.setItem(key, String(Date.now()));
      }
    } catch {
      // Ignore sessionStorage failures and still navigate.
    }

    let cancelled = false;
    void (async () => {
      await handoffSessionToSpeicherGrenze();
      if (!cancelled && !bounced) {
        window.location.assign(dest);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dest]);

  return (
    <AuthShell
      title="Weiterleitung"
      subtitle="Sie werden zu SpeicherGrenze weitergeleitet. Falls nichts passiert, nutzen Sie den Button."
    >
      <button
        type="button"
        className={primaryBtn}
        onClick={() => {
          void (async () => {
            await handoffSessionToSpeicherGrenze();
            window.location.assign(dest);
          })();
        }}
      >
        Weiter
      </button>
    </AuthShell>
  );
}
