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
          <form action={logoutAction} className="mt-6">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] px-4 py-2.5 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#f1f5f9] sm:w-auto"
            >
              Abmelden
            </button>
          </form>

          <section className="mt-10 border-t border-[#E2E8F0] pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#94a3b8]">
              Verfügbare Werkzeuge
            </h2>
            <a
              href="https://speicher.pvnavigator.de/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex flex-col rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-4 transition hover:border-[#F59E0B]/35 hover:bg-white hover:shadow-[0_8px_24px_-16px_rgba(15,23,42,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div>
                <p className="font-semibold text-[#0F172A]">SpeicherGrenze</p>
                <p className="mt-1 text-sm text-[#64748B]">Speicherbeitrag und Nutzungsgrenzen simulieren.</p>
              </div>
              <span className="mt-3 inline-flex shrink-0 items-center text-sm font-semibold text-[#F59E0B] sm:mt-0">
                SpeicherGrenze öffnen →
              </span>
            </a>
            <p className="mt-4 text-xs text-[#94a3b8]">
              Weitere Tools finden Sie auf der{" "}
              <Link href="/" className="font-medium text-[#b45309] hover:underline">
                Startseite
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
