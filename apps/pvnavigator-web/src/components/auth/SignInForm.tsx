"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthFormErrorAlert } from "@/components/auth/AuthFormErrorAlert";

export function SignInForm({
  nextPath,
  error,
}: {
  nextPath: string;
  error?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action="/auth/sign-in"
      method="post"
      className="space-y-4"
      onSubmit={() => setPending(true)}
    >
      <input type="hidden" name="next" value={nextPath} readOnly />
      <div>
        <label htmlFor="signin-email" className="block text-sm font-medium text-[#0F172A]">
          E-Mail
        </label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] shadow-sm outline-none ring-[#F59E0B]/30 focus:border-[#F59E0B]/45 focus:ring-2"
        />
      </div>
      <div>
        <label htmlFor="signin-password" className="block text-sm font-medium text-[#0F172A]">
          Passwort
        </label>
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] shadow-sm outline-none ring-[#F59E0B]/30 focus:border-[#F59E0B]/45 focus:ring-2"
        />
      </div>
      {error ? <AuthFormErrorAlert message={error} /> : null}
      <button
        type="submit"
        aria-busy={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98]"
      >
        {pending ? "Wird angemeldet…" : "Anmelden"}
      </button>
      <p className="text-center text-sm text-[#64748B]">
        Noch kein Konto?{" "}
        <Link href="/konto-erstellen" className="font-semibold text-[#b45309] hover:underline">
          Konto erstellen
        </Link>
      </p>
    </form>
  );
}
