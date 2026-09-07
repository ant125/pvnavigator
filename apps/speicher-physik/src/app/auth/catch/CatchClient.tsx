"use client";

import { useEffect, useRef, useState } from "react";
import {
  AUTH_ACCEPT_PATH,
  AUTH_CATCH_PATH,
  getHubKontoUrl,
} from "@pv-auth/session";

export function CatchClient() {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const [handoff, setHandoff] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "1") {
      setFailed(true);
      return;
    }
    const payload = window.location.hash.replace(/^#/, "");
    window.history.replaceState(null, "", AUTH_CATCH_PATH);
    if (!payload) {
      setFailed(true);
      return;
    }
    setHandoff(payload);
  }, []);

  useEffect(() => {
    if (!handoff || submitted.current) return;
    submitted.current = true;
    formRef.current?.submit();
  }, [handoff]);

  if (failed) {
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

  return (
    <form ref={formRef} action={AUTH_ACCEPT_PATH} method="post" className="px-4 py-10 text-center text-sm text-slate-400">
      <input type="hidden" name="handoff" value={handoff} />
      <p>Weiterleitung …</p>
      <button type="submit" className="mt-4 underline">
        Weiter
      </button>
    </form>
  );
}
