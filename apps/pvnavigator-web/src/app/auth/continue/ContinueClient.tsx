"use client";

import { useEffect, useRef } from "react";
import { getSpeicherGrenzeOrigin, rehomeReadableAuthCookiesInBrowser } from "@pv-auth/session";

import { AuthShell } from "@/components/auth/AuthShell";

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98] disabled:opacity-60";

export function ContinueClient({
  dest: _dest,
  accessToken,
  refreshToken,
}: {
  dest: string;
  accessToken: string;
  refreshToken: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const hasSession = Boolean(accessToken && refreshToken);
  const acceptUrl = `${getSpeicherGrenzeOrigin()}/auth/accept`;

  useEffect(() => {
    void rehomeReadableAuthCookiesInBrowser();
    if (!hasSession || submitted.current) return;
    submitted.current = true;
    formRef.current?.submit();
  }, [hasSession]);

  return (
    <AuthShell
      title="Weiterleitung"
      subtitle="Sie werden zu SpeicherGrenze weitergeleitet. Falls nichts passiert, nutzen Sie den Button."
    >
      {hasSession ? (
        <form ref={formRef} action={acceptUrl} method="post">
          <input type="hidden" name="access_token" value={accessToken} />
          <input type="hidden" name="refresh_token" value={refreshToken} />
          <button type="submit" className={primaryBtn}>
            Weiter
          </button>
        </form>
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
