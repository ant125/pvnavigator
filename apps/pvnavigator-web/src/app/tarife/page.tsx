import type { Metadata } from "next";

import { paidPlanById } from "@pv-access/core";

import { TariffGrid } from "@/components/tariffs/TariffGrid";
import {
  FREE_ADDRESS_SELECT,
  STRIPE_SUBSCRIPTION_SELECT,
  SUBSCRIPTION_PERIOD_SELECT,
  pickStripeSubscription,
  summarizeAccess,
  tariffViewer,
  TARIFF_HINTS,
  type FreeAddressRow,
  type StripeSubscriptionRow,
  type SubscriptionPeriodRow,
} from "@/lib/accessSummary";
import { getServerUser } from "@/lib/auth";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Tarife | PVNAVIGATOR_",
  description: "Kostenlos, STARTER, ABO und PRO.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ hinweis?: string | string[]; auswahl?: string | string[] }>;

export default async function TarifePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const hintKey = Array.isArray(sp.hinweis) ? sp.hinweis[0] : sp.hinweis;
  const auswahl = Array.isArray(sp.auswahl) ? sp.auswahl[0] : sp.auswahl;
  const hint = hintKey ? TARIFF_HINTS[hintKey] : undefined;
  const user = isSupabaseConfigured() ? await getServerUser() : null;

  let viewer = tariffViewer(false, null);
  if (user) {
    const supabase = await createServerSupabaseClient();
    const [periodsResult, usageResult, freeAddressResult, billingResult, customerResult] =
      await Promise.all([
        supabase.from("subscription_periods").select(SUBSCRIPTION_PERIOD_SELECT).order("period_end", { ascending: false }),
        supabase.from("subscription_period_addresses").select("period_id"),
        supabase.from("free_addresses").select(FREE_ADDRESS_SELECT).maybeSingle(),
        supabase.from("stripe_subscriptions").select(STRIPE_SUBSCRIPTION_SELECT),
        supabase.from("stripe_customers").select("user_id").maybeSingle(),
      ]);
    const usedAddressesByPeriod: Record<string, number> = {};
    for (const row of (usageResult.data ?? []) as { period_id: string }[]) {
      usedAddressesByPeriod[row.period_id] = (usedAddressesByPeriod[row.period_id] ?? 0) + 1;
    }
    const summary = summarizeAccess({
      now: new Date(),
      periods: (periodsResult.data ?? []) as SubscriptionPeriodRow[],
      usedAddressesByPeriod,
      freeAddress: (freeAddressResult.data as FreeAddressRow | null) ?? null,
      billing: pickStripeSubscription((billingResult.data ?? []) as StripeSubscriptionRow[]),
      canManagePortal: Boolean(customerResult.data),
    });
    viewer = tariffViewer(true, summary);
  }

  const resumePlan = viewer.kind === "current_free" && !hint ? paidPlanById(auswahl) : null;
  const upgradeLocked = hintKey === "upgrade-ausstehend" || hintKey === "bitte-warten";

  return (
    <div className="px-4 py-8 md:py-10">
      <div className="mx-auto w-full max-w-[1280px]">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-[1.75rem]">Tarife</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#64748B] sm:text-base">
            Für Ihr Zuhause oder Ihre PV-Projekte.
          </p>
        </header>
        {hint ? (
          <p
            role="status"
            className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm leading-relaxed text-[#334155]"
          >
            {hint}
          </p>
        ) : null}
        <div className="mt-8">
          <TariffGrid viewer={viewer} resumePlan={resumePlan} upgradeLocked={upgradeLocked} />
        </div>
      </div>
    </div>
  );
}
