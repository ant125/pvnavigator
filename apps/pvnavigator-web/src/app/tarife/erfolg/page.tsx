import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSpeicherGrenzeOrigin } from "@pv-auth/session";

import { PaymentConfirmation } from "@/components/tariffs/PaymentConfirmation";
import { getServerUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Zahlung | PVNAVIGATOR_",
  description: "Bestätigung der PVNAVIGATOR_ Zahlung.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ session_id?: string | string[] }>;

export default async function TarifeErfolgPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getServerUser();
  if (!user) redirect("/anmelden?next=/tarife");
  const sp = await searchParams;
  const sessionId = Array.isArray(sp.session_id) ? sp.session_id[0] : sp.session_id;
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return (
      <div className="px-4 py-10">
        <div className="mx-auto max-w-lg text-sm text-[#64748B]">
          <p>Keine Zahlungsbestätigung vorhanden. Der Zugang wurde nicht geändert.</p>
          <p className="mt-4">
            <Link href="/tarife" className="font-semibold text-[#b45309] hover:underline">
              Zu den Tarifen
            </Link>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-lg">
        <PaymentConfirmation sessionId={sessionId} speicherUrl={getSpeicherGrenzeOrigin()} />
      </div>
    </div>
  );
}
