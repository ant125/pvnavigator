import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PVNAVIGATOR_ ist kostenlos",
  description: "SPEICHERGRENZE kann mit einem Konto kostenlos genutzt werden.",
};

export default function TarifeErfolgPage() {
  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">PVNAVIGATOR_ ist kostenlos</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
          Eine Zahlungsbestätigung ändert den Zugang nicht. SPEICHERGRENZE bleibt mit Ihrem Konto nutzbar.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="text-sm font-semibold text-[#b45309] hover:underline">
            Zur Startseite
          </Link>
          <Link href="/konto" className="text-sm font-semibold text-[#64748B] hover:text-[#0F172A]">
            Zum Konto
          </Link>
        </div>
      </div>
    </div>
  );
}
