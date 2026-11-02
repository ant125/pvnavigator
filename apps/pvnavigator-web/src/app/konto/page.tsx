import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AUTH_SIGN_OUT_PATH, getSpeicherGrenzeCalculateUrl, getSpeicherGrenzeOrigin } from "@pv-auth/session";

import { AccessCard } from "@/components/account/AccessCard";
import { InvoiceHistoryCard } from "@/components/account/InvoiceHistoryCard";
import { CalculationsEmptyState, CalculationsHistory } from "@/components/account/CalculationsHistory";
import { AuthEnvMissing } from "@/components/auth/AuthEnvMissing";
import { INVOICE_HISTORY_HINTS } from "@/lib/billing/invoicePortal";
import { recoverAccountCheckouts } from "@/lib/billing/paymentRecoveryServer";
import {
  FREE_ADDRESS_SELECT,
  STRIPE_SUBSCRIPTION_SELECT,
  SUBSCRIPTION_PERIOD_SELECT,
  pickStripeSubscription,
  summarizeAccess,
  type FreeAddressRow,
  type StripeSubscriptionRow,
  type SubscriptionPeriodRow,
} from "@/lib/accessSummary";
import { CALCULATION_LIST_SELECT, type CalculationListRow } from "@/lib/calculationsList";
import { getServerUser } from "@/lib/auth";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const metadata: Metadata = {
  title: "Mein Konto | PVNAVIGATOR_",
  description: "PVNAVIGATOR_-Konto: Berechnungen und Werkzeuge verwalten.",
};

const badgeBase =
  "inline-flex w-fit rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1";

const card =
  "rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]";

const ghostBtn =
  "inline-flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[#64748B] shadow-sm transition hover:bg-[#FAFBFC] hover:text-[#0F172A]";

type SearchParams = Promise<{ hinweis?: string | string[] }>;

export default async function KontoPage({ searchParams }: { searchParams: SearchParams }) {
  const hintParam = await searchParams;
  const hintKey = Array.isArray(hintParam.hinweis) ? hintParam.hinweis[0] : hintParam.hinweis;
  const invoiceHint = hintKey ? INVOICE_HISTORY_HINTS[hintKey] : undefined;

  if (!isSupabaseConfigured()) {
    return (
      <div className="px-4 py-8 md:py-10">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-[1.75rem]">
            Mein Konto
          </h1>
          <div className={`mt-8 max-w-lg p-6 sm:p-8 ${card}`}>
            <AuthEnvMissing />
          </div>
        </div>
      </div>
    );
  }

  const user = await getServerUser();
  if (!user?.email) {
    redirect("/anmelden?next=/konto");
  }

  const speicherOrigin = getSpeicherGrenzeOrigin();
  const calculateUrl = getSpeicherGrenzeCalculateUrl();
  const supabase = await createServerSupabaseClient();
  const admin = createServiceRoleClient();
  const calculationsPromise = supabase
    .from("calculations")
    .select(CALCULATION_LIST_SELECT)
    .order("updated_at", { ascending: false });
  if (admin) {
    try {
      await recoverAccountCheckouts(user.id);
    } catch (error) {
      console.error("account checkout recovery failed", error instanceof Error ? error.name : "error");
    }
  }
  const [calculationsResult, periodsResult, usageResult, freeAddressResult, billingResult, customerResult, invoiceResult] =
    await Promise.all([
      calculationsPromise,
      supabase
        .from("subscription_periods")
        .select(SUBSCRIPTION_PERIOD_SELECT)
        .order("period_end", { ascending: false }),
      supabase.from("subscription_period_addresses").select("period_id"),
      supabase.from("free_addresses").select(FREE_ADDRESS_SELECT).maybeSingle(),
      supabase.from("stripe_subscriptions").select(STRIPE_SUBSCRIPTION_SELECT),
      supabase.from("stripe_customers").select("user_id").maybeSingle(),
      admin
        ? admin.from("stripe_invoices").select("stripe_invoice_id").eq("user_id", user.id).limit(1)
        : Promise.resolve({ data: [] as { stripe_invoice_id: string }[], error: null }),
    ]);

  if (calculationsResult.error) {
    console.error("Failed to load calculations", calculationsResult.error);
  }
  if (periodsResult.error) {
    console.error("Failed to load subscription periods", periodsResult.error);
  }
  if (usageResult.error) {
    console.error("Failed to load subscription usage", usageResult.error);
  }
  if (freeAddressResult.error) {
    console.error("Failed to load free address", freeAddressResult.error);
  }
  if (billingResult.error) {
    console.error("Failed to load subscription status", billingResult.error);
  }
  if (customerResult.error) {
    console.error("Failed to load billing customer", customerResult.error);
  }
  if (invoiceResult.error) {
    console.error("Failed to load invoice history", invoiceResult.error);
  }
  const hasInvoices =
    !customerResult.error &&
    Boolean(customerResult.data) &&
    !invoiceResult.error &&
    (invoiceResult.data?.length ?? 0) > 0;

  const calculations = (calculationsResult.data ?? []) as CalculationListRow[];
  const usedAddressesByPeriod: Record<string, number> = {};
  for (const row of (usageResult.data ?? []) as { period_id: string }[]) {
    usedAddressesByPeriod[row.period_id] = (usedAddressesByPeriod[row.period_id] ?? 0) + 1;
  }
  const accessSummary = summarizeAccess({
    now: new Date(),
    periods: (periodsResult.data ?? []) as SubscriptionPeriodRow[],
    usedAddressesByPeriod,
    freeAddress: (freeAddressResult.data as FreeAddressRow | null) ?? null,
    billing: billingResult.error
      ? null
      : pickStripeSubscription((billingResult.data ?? []) as StripeSubscriptionRow[]),
    canManagePortal: !customerResult.error && Boolean(customerResult.data),
  });

  return (
    <div className="px-4 py-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-[1.75rem]">
            Mein Konto
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#64748B] sm:text-base">
            Verwalten Sie Ihre PVNAVIGATOR_-Berechnungen und Werkzeuge.
          </p>
          <p className="mt-2 truncate text-xs text-[#94a3b8]" title={user.email}>
            Angemeldet als {user.email}
          </p>
        </header>

        {invoiceHint ? (
          <p
            role="status"
            className="mt-6 max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm leading-relaxed text-[#334155]"
          >
            {invoiceHint}
          </p>
        ) : null}

        <section className="mt-8" aria-labelledby="access-heading">
          <h2
            id="access-heading"
            className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]"
          >
            Zugang
          </h2>
          <div className="mt-3">
            <AccessCard summary={accessSummary} />
          </div>
        </section>

        {hasInvoices ? (
          <section className="mt-8" aria-labelledby="invoices-heading">
            <InvoiceHistoryCard />
          </section>
        ) : null}

        <section className="mt-8 md:mt-10" aria-labelledby="calculations-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2
              id="calculations-heading"
              className="text-lg font-semibold tracking-tight text-[#0F172A]"
            >
              Meine Berechnungen
            </h2>
          </div>
          {calculations.length === 0 ? (
            <CalculationsEmptyState calculateUrl={calculateUrl} />
          ) : (
            <CalculationsHistory rows={calculations} />
          )}
        </section>

        <section className="mt-10 md:mt-12" aria-labelledby="tools-heading">
          <h2
            id="tools-heading"
            className="text-lg font-semibold tracking-tight text-[#0F172A]"
          >
            Werkzeuge
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            <li>
              <a
                href={speicherOrigin}
                className={`group flex h-full flex-col p-5 transition hover:border-[#F59E0B]/30 hover:shadow-[0_12px_32px_-18px_rgba(15,23,42,0.12)] ${card}`}
              >
                <span className={`${badgeBase} bg-emerald-50 text-emerald-800 ring-emerald-100/90`}>
                  Live
                </span>
                <p className="mt-3 text-[0.95rem] font-semibold text-[#0F172A] group-hover:text-[#b45309]">
                  SPEICHERGRENZE
                </p>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[#64748B]">
                  Real nutzbarer Speicherbeitrag aus Verbrauch und PV-Erzeugung.
                </p>
                <span className="mt-4 text-sm font-semibold text-[#F59E0B]">Öffnen</span>
              </a>
            </li>
            <li className={`flex h-full flex-col p-5 ${card}`}>
              <span className={`${badgeBase} bg-slate-50 text-slate-600 ring-slate-200/90`}>
                In Entwicklung
              </span>
              <p className="mt-3 text-[0.95rem] font-semibold text-[#0F172A]">
                RENDITEGUIDE
              </p>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[#64748B]">
                Wirtschaftlichkeitsanalyse für PV-Anlagen und Batteriespeicher. Vergleichen Sie
                Investitionen, Amortisation und den finanziellen Vorteil nach 10 und 20 Jahren.
              </p>
              <span className="mt-4 text-sm font-medium text-[#94a3b8]">Demnächst</span>
            </li>
            <li className={`flex h-full flex-col p-5 ${card}`}>
              <span className={`${badgeBase} bg-amber-50/90 text-amber-900/80 ring-amber-100`}>
                Geplant
              </span>
              <p className="mt-3 text-[0.95rem] font-semibold text-[#0F172A]">PVShadow</p>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[#64748B]">
                Dachgeometrie und Verschattung für präzisere PV-Planung.
              </p>
              <span className="mt-4 text-sm font-medium text-[#94a3b8]">Geplant</span>
            </li>
          </ul>
        </section>

        <section
          className="mt-12 border-t border-[#E2E8F0] pt-6 md:mt-14"
          aria-labelledby="account-heading"
        >
          <h2 id="account-heading" className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
            Konto
          </h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="truncate text-sm text-[#64748B]" title={user.email}>
              {user.email}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/" className="text-sm font-medium text-[#64748B] transition-colors hover:text-[#0F172A]">
                Zur Startseite
              </Link>
              <form action={AUTH_SIGN_OUT_PATH} method="post">
                <button type="submit" className={ghostBtn}>
                  Abmelden
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
