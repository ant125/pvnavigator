import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import { AuthEnvMissing } from "@/components/auth/AuthEnvMissing";
import { getServerUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mein Konto | PVNavigator",
  description: "Ihr PVNavigator-Konto.",
};

export default async function KontoPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="px-4 py-10 md:py-14">
        <div className="mx-auto w-full max-w-lg">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight text-[#0F172A] sm:text-[1.35rem]">Mein Konto</h1>
            <div className="mt-6">
              <AuthEnvMissing />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const user = await getServerUser();
  if (!user?.email) {
    redirect("/anmelden?next=/konto");
  }

  return (
    <div className="px-4 py-10 md:py-14">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-[#0F172A] sm:text-[1.35rem]">Mein Konto</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
            Sie sind mit{" "}
            <span className="font-medium text-[#0F172A]">{user.email}</span> angemeldet.
          </p>

          <div className="mt-6 rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">E-Mail-Adresse</p>
            <p className="mt-1.5 break-all text-sm font-medium text-[#0F172A]">{user.email}</p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#FAFBFC] sm:w-auto sm:min-w-[10rem]"
            >
              Zur Startseite
            </Link>
            <form action={logoutAction} className="w-full sm:w-auto">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] px-4 py-2.5 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#f1f5f9] sm:w-auto sm:min-w-[10rem]"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
