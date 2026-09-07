"use client";

import { useEffect } from "react";
import {
  encodeSessionHandoffPayload,
  getSpeicherGrenzeOrigin,
  rehomeReadableAuthCookiesInBrowser,
} from "@pv-auth/session";

import { AuthShell } from "@/components/auth/AuthShell";

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98]";

function speicherCatchUrl(accessToken: string, refreshToken: string): string {
  const payload = encodeSessionHandoffPayload(accessToken, refreshToken);
  return `${getSpeicherGrenzeOrigin()}/auth/catch#${payload}`;
}

export function ContinueClient({
  dest: _dest,
  accessToken,
  refreshToken,
}: {
  dest: string;
  accessToken: string;
  refreshToken: string;
}) {
  const hasSession = Boolean(accessToken && refreshToken);
  const href = hasSession ? speicherCatchUrl(accessToken, refreshToken) : "/anmelden";

  useEffect(() => {
    void rehomeReadableAuthCookiesInBrowser();
    if (!hasSession) return;
    window.location.replace(href);
  }, [hasSession, href]);

  return (
    <AuthShell
      title="Weiterleitung"
      subtitle="Sie werden zu SpeicherGrenze weitergeleitet. Falls nichts passiert, nutzen Sie den Button."
    >
      {hasSession ? (
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
