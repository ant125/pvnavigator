"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const primaryBtnFullWidth =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98]";

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98] sm:w-auto sm:min-w-[10rem]";

const secondaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#FAFBFC] sm:w-auto sm:min-w-[10rem]";

function hasSupabaseConfirmationErrorParams(params: URLSearchParams): boolean {
  return (
    (params.get("error")?.length ?? 0) > 0 ||
    (params.get("error_code")?.length ?? 0) > 0 ||
    (params.get("error_description")?.length ?? 0) > 0
  );
}

function ConfirmationErrorLinks() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link href="/anmelden" className={primaryBtn}>
        Anmelden
      </Link>
      <Link href="/konto-erstellen" className={secondaryBtn}>
        Konto erstellen
      </Link>
    </div>
  );
}

function ConfirmationSuccessLinks() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/anmelden" className={primaryBtnFullWidth}>
        Jetzt anmelden
      </Link>
      <Link
        href="/"
        className="text-center text-sm font-medium text-[#b45309] transition-colors hover:underline"
      >
        Zur Startseite
      </Link>
    </div>
  );
}

export function BestaetigtConfirmClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exchangeFailed, setExchangeFailed] = useState(false);

  const code = searchParams.get("code");
  const paramsError = hasSupabaseConfirmationErrorParams(searchParams);

  useEffect(() => {
    if (paramsError || !code) return;

    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    void (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;
      if (error) {
        setExchangeFailed(true);
        return;
      }
      router.replace("/auth/bestaetigt");
    })();

    return () => {
      cancelled = true;
    };
  }, [code, paramsError, router]);

  if (paramsError || exchangeFailed) {
    return (
      <AuthShell
        title="Bestätigung fehlgeschlagen"
        subtitle="Der Bestätigungslink ist ungültig oder abgelaufen."
      >
        <ConfirmationErrorLinks />
      </AuthShell>
    );
  }

  if (code) {
    return (
      <AuthShell title="E-Mail wird bestätigt …">
        <p role="status" className="text-sm leading-relaxed text-[#64748B]">
          Bitte einen Moment.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="E-Mail bestätigt"
      subtitle="Ihr Konto wurde erfolgreich aktiviert. Sie können sich jetzt anmelden."
    >
      <ConfirmationSuccessLinks />
    </AuthShell>
  );
}
