import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { BestaetigtConfirmClient } from "./BestaetigtConfirmClient";

export const metadata: Metadata = {
  title: "E-Mail-Bestätigung | PVNavigator",
  description: "E-Mail-Adresse für Ihr PVNavigator-Konto bestätigen.",
};

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98] sm:w-auto sm:min-w-[10rem]";

const secondaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#FAFBFC] sm:w-auto sm:min-w-[10rem]";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function hasSupabaseConfirmationError(
  sp: Record<string, string | string[] | undefined>,
): boolean {
  return (
    firstParam(sp.error).length > 0 ||
    firstParam(sp.error_code).length > 0 ||
    firstParam(sp.error_description).length > 0
  );
}

function BestaetigtSuspenseFallback() {
  return (
    <AuthShell title="E-Mail wird bestätigt …">
      <p role="status" className="text-sm leading-relaxed text-[#64748B]">
        Bitte einen Moment.
      </p>
    </AuthShell>
  );
}

export default async function BestaetigtPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const isError = hasSupabaseConfirmationError(sp);

  if (isError) {
    return (
      <AuthShell
        title="Bestätigung fehlgeschlagen"
        subtitle="Der Bestätigungslink ist ungültig oder abgelaufen."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/anmelden" className={primaryBtn}>
            Anmelden
          </Link>
          <Link href="/konto-erstellen" className={secondaryBtn}>
            Konto erstellen
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <Suspense fallback={<BestaetigtSuspenseFallback />}>
      <BestaetigtConfirmClient />
    </Suspense>
  );
}
