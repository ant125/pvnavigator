"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import {
  signUpAction,
  type SignUpFormState,
} from "@/app/actions/auth";

const signUpInitial: SignUpFormState = {
  error: "",
  success: false,
  needsConfirmation: false,
};

const passwordMismatchGerman = "Die Passwörter stimmen nicht überein.";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, signUpInitial);
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  if (state.success && state.needsConfirmation) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
        >
          <p className="font-medium">Konto erstellt</p>
          <p className="mt-2 leading-relaxed text-emerald-900/90">
            Bitte bestätigen Sie Ihre E-Mail-Adresse.
          </p>
        </div>
        <p className="text-sm text-[#64748B]">
          Danach können Sie sich{" "}
          <Link href="/anmelden" className="font-semibold text-[#b45309] hover:underline">
            anmelden
          </Link>
          .
        </p>
      </div>
    );
  }

  const validationError =
    passwordMismatch ? passwordMismatchGerman : state.error.length > 0 ? state.error : null;

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={(e) => {
        const form = e.currentTarget;
        const fd = new FormData(form);
        const p = String(fd.get("password") ?? "");
        const c = String(fd.get("password_confirm") ?? "");
        if (p !== c) {
          e.preventDefault();
          setPasswordMismatch(true);
        } else {
          setPasswordMismatch(false);
        }
      }}
    >
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
          disabled={pending}
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] shadow-sm outline-none ring-[#F59E0B]/30 focus:border-[#F59E0B]/45 focus:ring-2 disabled:opacity-60"
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
          disabled={pending}
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] shadow-sm outline-none ring-[#F59E0B]/30 focus:border-[#F59E0B]/45 focus:ring-2 disabled:opacity-60"
          onChange={() => setPasswordMismatch(false)}
        />
        <p className="mt-1.5 text-xs text-[#94a3b8]">Mindestens 6 Zeichen.</p>
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
          disabled={pending}
          aria-invalid={passwordMismatch ? true : undefined}
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] shadow-sm outline-none ring-[#F59E0B]/30 focus:border-[#F59E0B]/45 focus:ring-2 disabled:opacity-60"
          onChange={() => setPasswordMismatch(false)}
        />
      </div>
      {validationError ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {validationError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Wird erstellt…" : "Konto erstellen"}
      </button>
      <p className="text-center text-sm text-[#64748B]">
        Bereits registriert?{" "}
        <Link href="/anmelden" className="font-semibold text-[#b45309] hover:underline">
          Anmelden
        </Link>
      </p>
    </form>
  );
}
