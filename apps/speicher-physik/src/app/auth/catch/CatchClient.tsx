"use client";

import { useEffect, useState } from "react";
import {
  AUTH_ACCEPT_PATH,
  AUTH_CATCH_PATH,
  decodeAuthHandoff,
  getHubKontoUrl,
  getSpeicherGrenzeCalculateUrl,
} from "@pv-auth/session";

export function CatchClient() {
  const [status, setStatus] = useState<"working" | "missing" | "failed">("working");

  useEffect(() => {
    const payload = window.location.hash.replace(/^#/, "");
    window.history.replaceState(null, "", AUTH_CATCH_PATH);
    const handoff = decodeAuthHandoff(payload);
    if (!handoff) {
      setStatus("missing");
      return;
    }

    void (async () => {
      try {
        const body =
          handoff.type === "cookies"
            ? { cookies: handoff.cookies }
            : {
                access_token: handoff.accessToken,
                refresh_token: handoff.refreshToken,
              };
        const response = await fetch(AUTH_ACCEPT_PATH, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          setStatus("failed");
          return;
        }
        window.location.replace(getSpeicherGrenzeCalculateUrl());
      } catch {
        setStatus("failed");
      }
    })();
  }, []);

  if (status === "missing" || status === "failed") {
    return (
      <p className="px-4 py-10 text-center text-sm text-slate-400">
        Anmeldung auf SpeicherGrenze fehlgeschlagen. Bitte öffnen Sie{" "}
        <a className="underline" href={getHubKontoUrl()}>
          Mein Konto
        </a>{" "}
        und versuchen Sie es erneut.
      </p>
    );
  }

  return <p className="px-4 py-10 text-center text-sm text-slate-400">Weiterleitung …</p>;
}
