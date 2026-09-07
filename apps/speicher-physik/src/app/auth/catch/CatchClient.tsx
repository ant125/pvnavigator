"use client";

import { useEffect, useState } from "react";
import {
  AUTH_ACCEPT_PATH,
  AUTH_CATCH_PATH,
  decodeSessionHandoffPayload,
  getHubLoginUrlForSpeicherCalculate,
  getSpeicherGrenzeCalculateUrl,
} from "@pv-auth/session";

export function CatchClient() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const payload = window.location.hash.replace(/^#/, "");
    window.history.replaceState(null, "", AUTH_CATCH_PATH);
    const decoded = decodeSessionHandoffPayload(payload);
    if (!decoded) {
      setMissing(true);
      return;
    }

    void (async () => {
      try {
        const response = await fetch(AUTH_ACCEPT_PATH, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: decoded.accessToken,
            refresh_token: decoded.refreshToken,
          }),
        });
        window.location.replace(
          response.ok
            ? getSpeicherGrenzeCalculateUrl()
            : getHubLoginUrlForSpeicherCalculate(),
        );
      } catch {
        window.location.replace(getHubLoginUrlForSpeicherCalculate());
      }
    })();
  }, []);

  if (missing) {
    return (
      <p className="px-4 py-10 text-center text-sm text-slate-400">
        Sitzung nicht gefunden. Bitte erneut{" "}
        <a className="underline" href={getHubLoginUrlForSpeicherCalculate()}>
          anmelden
        </a>
        .
      </p>
    );
  }

  return <p className="px-4 py-10 text-center text-sm text-slate-400">Weiterleitung …</p>;
}
