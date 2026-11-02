import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Zahlung abgebrochen | PVNAVIGATOR_",
  description: "Der Bezahlvorgang wurde abgebrochen.",
};

export default function TarifeAbgebrochenPage() {
  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">Zahlung abgebrochen</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
          Der Bezahlvorgang wurde abgebrochen. Ihr bisheriger Tarif bleibt unverändert. Ein neuer Zeitraum wurde nicht freigeschaltet.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/tarife" className="text-sm font-semibold text-[#b45309] hover:underline">
            Zu den Tarifen
          </Link>
          <Link href="/konto" className="text-sm font-semibold text-[#64748B] hover:text-[#0F172A]">
            Zum Konto
          </Link>
        </div>
      </div>
    </div>
  );
}
