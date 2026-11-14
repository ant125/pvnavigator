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
          className="hub-input"
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
          className="hub-input"
        />
      </div>
      {error ? <AuthFormErrorAlert message={error} /> : null}
      <button
        type="submit"
        aria-busy={pending}
        className="hub-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Wird angemeldet…" : "Anmelden"}
      </button>
      <p className="text-center text-sm text-[#64748B]">
        Noch kein Konto?{" "}
        <Link
          href={
            nextPath && nextPath !== "/"
              ? `/konto-erstellen?next=${encodeURIComponent(nextPath)}`
              : "/konto-erstellen"
          }
          className="font-semibold text-[#36533c] hover:underline"
        >
          Konto erstellen
        </Link>
      </p>
    </form>
  );
}
