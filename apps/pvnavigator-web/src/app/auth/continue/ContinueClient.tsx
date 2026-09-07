"use client";

import { useEffect } from "react";
import { getSpeicherGrenzeOrigin, rehomeReadableAuthCookiesInBrowser } from "@pv-auth/session";

import { AuthShell } from "@/components/auth/AuthShell";

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98]";

export function ContinueClient({
  dest: _dest,
  payload,
}: {
  dest: string;
  payload: string;
}) {
  const href = payload ? `${getSpeicherGrenzeOrigin()}/auth/catch#${payload}` : "";

  useEffect(() => {
    void rehomeReadableAuthCookiesInBrowser();
  }, []);

  return (
    <AuthShell
      title="Weiterleitung"
      subtitle="Weiter zu SpeicherGrenze. Die Seite wechselt erst nach dem Klick."
    >
      {href ? (
        <a href={href} className={primaryBtn}>
          Weiter
        </a>
      ) : (
        <p className="text-sm text-[#64748B]">
          Sitzung nicht gefunden. Bitte erneut{" "}
          <a className="font-medium text-[#0F172A] underline" href="/anmelden">
            anmelden
          </a>
          .
        </p>
      )}
    </AuthShell>
  );
}
