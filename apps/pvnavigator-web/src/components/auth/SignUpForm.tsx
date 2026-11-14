"use client";

import { useState } from "react";
import Link from "next/link";

import { AuthFormErrorAlert } from "@/components/auth/AuthFormErrorAlert";
import type { AccountKindChoice } from "@/lib/accountProfile";

const passwordMismatchGerman = "Die Passwörter stimmen nicht überein.";

export function SignUpForm({
  error,
  needsConfirmation,
  nextPath = "/konto",
}: {
  error?: string;
  needsConfirmation?: boolean;
  nextPath?: string;
}) {
  const [pending, setPending] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [kind, setKind] = useState<AccountKindChoice>("privat");

  if (needsConfirmation) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="hub-notice text-sm"
        >
          <p className="font-medium">Konto erstellt</p>
          <p className="mt-2 leading-relaxed text-[#526057]">
            Bitte bestätigen Sie Ihre E-Mail-Adresse.
          </p>
        </div>
        <p className="text-sm text-[#64748B]">
          Danach können Sie sich{" "}
          <Link
            href={nextPath && nextPath !== "/konto" ? `/anmelden?next=${encodeURIComponent(nextPath)}` : "/anmelden"}
            className="font-semibold text-[#36533c] hover:underline"
          >
            anmelden
          </Link>
          .
        </p>
      </div>
    );
  }

  const validationError =
    passwordMismatch ? passwordMismatchGerman : error ? error : null;

  return (
    <form
      action="/auth/sign-up"
      method="post"
      className="space-y-4"
      onSubmit={(e) => {
        const form = e.currentTarget;
        const fd = new FormData(form);
        const p = String(fd.get("password") ?? "");
        const c = String(fd.get("password_confirm") ?? "");
        if (p !== c) {
          e.preventDefault();
          setPasswordMismatch(true);
          return;
        }
        setPasswordMismatch(false);
        setPending(true);
      }}
    >
      <input type="hidden" name="next" value={nextPath} readOnly />
      <fieldset className="space-y-2">
        <legend className="block text-sm font-medium text-[#0F172A]">Art des Kontos</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="account_kind" value="privat" checked={kind === "privat"} onChange={() => setKind("privat")} required />
          Privatperson
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="account_kind" value="unternehmen" checked={kind === "unternehmen"} onChange={() => setKind("unternehmen")} />
          Unternehmen
        </label>
      </fieldset>
      {kind === "unternehmen" ? (
        <div>
          <label htmlFor="signup-company" className="block text-sm font-medium text-[#0F172A]">Firmenname</label>
          <input id="signup-company" name="company_name" required maxLength={160} autoComplete="organization" className="hub-input" />
        </div>
      ) : null}
      <div>
        <label htmlFor="signup-given" className="block text-sm font-medium text-[#0F172A]">
          {kind === "unternehmen" ? "Ansprechpartner (Vorname)" : "Vorname"}
        </label>
        <input id="signup-given" name="given_name" required maxLength={80} autoComplete="given-name" className="hub-input" />
      </div>
      <div>
        <label htmlFor="signup-family" className="block text-sm font-medium text-[#0F172A]">
          {kind === "unternehmen" ? "Ansprechpartner (Nachname)" : "Nachname"}
        </label>
        <input id="signup-family" name="family_name" required maxLength={80} autoComplete="family-name" className="hub-input" />
      </div>
      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-[#0F172A]">
          E-Mail
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="hub-input"
        />
      </div>
      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium text-[#0F172A]">
          Passwort
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="hub-input"
          onChange={() => setPasswordMismatch(false)}
        />
        <p className="mt-1.5 text-xs text-[#627067]">Mindestens 6 Zeichen.</p>
      </div>
      <div>
        <label htmlFor="signup-password-confirm" className="block text-sm font-medium text-[#0F172A]">
          Passwort wiederholen
        </label>
        <input
          id="signup-password-confirm"
          name="password_confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          aria-invalid={passwordMismatch ? true : undefined}
          className="hub-input"
          onChange={() => setPasswordMismatch(false)}
        />
      </div>
      {validationError ? <AuthFormErrorAlert message={validationError} /> : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="hub-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Wird erstellt…" : "Konto erstellen"}
      </button>
      <p className="text-center text-sm text-[#64748B]">
        Bereits registriert?{" "}
        <Link
          href={nextPath && nextPath !== "/konto" ? `/anmelden?next=${encodeURIComponent(nextPath)}` : "/anmelden"}
          className="font-semibold text-[#36533c] hover:underline"
        >
          Anmelden
        </Link>
      </p>
    </form>
  );
}
