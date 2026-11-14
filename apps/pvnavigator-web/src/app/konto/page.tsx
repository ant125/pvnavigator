import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSpeicherGrenzeCalculateUrl, getSpeicherGrenzeOrigin } from "@pv-auth/session";

import { AccountDashboard } from "@/components/account/AccountDashboard";
import { AuthEnvMissing } from "@/components/auth/AuthEnvMissing";
import { accountProfileFromRow, emptyAccountProfile } from "@/lib/accountProfile";
import { isAdminSession } from "@/lib/admin";
import { INVOICE_HISTORY_HINTS } from "@/lib/billing/invoicePortal";
import { CALCULATION_LIST_SELECT, type CalculationListRow } from "@/lib/calculationsList";
import { getServerUser } from "@/lib/auth";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const metadata: Metadata = {
  title: "Mein Konto | PVNAVIGATOR_",
  description: "PVNAVIGATOR_-Konto: Berechnungen und Werkzeuge verwalten.",
};

const card = "hub-panel";

type SearchParams = Promise<{ hinweis?: string | string[]; profil?: string | string[] }>;

export default async function KontoPage({ searchParams }: { searchParams: SearchParams }) {
  const hintParam = await searchParams;
  const hintKey = Array.isArray(hintParam.hinweis) ? hintParam.hinweis[0] : hintParam.hinweis;
  const profileKey = Array.isArray(hintParam.profil) ? hintParam.profil[0] : hintParam.profil;
  const profileStatus = profileKey === "gespeichert" ? "saved" : profileKey === "ungueltig" ? "invalid" : null;
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
  // Fetch compact metadata in pages so large accounts are not silently truncated.
  const loadCalculations = async () => {
    const rows: CalculationListRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from("calculations").select(CALCULATION_LIST_SELECT)
        .eq("user_id", user.id).order("updated_at", { ascending: false })
        .order("id", { ascending: true }).range(offset, offset + 499);
      if (result.error) return {data: null, error: result.error};
      rows.push(...(result.data as unknown as CalculationListRow[]));
      if (result.data.length < 500) return {data: rows, error: null};
    }
  };
  const [calculationsResult, profileResult, customerResult, invoiceResult, isAdmin] = await Promise.all([
    loadCalculations(),
    supabase.from("profiles").select("account_kind, given_name, family_name, company_name").eq("id", user.id).maybeSingle(),
    supabase.from("stripe_customers").select("user_id").maybeSingle(),
    admin
      ? admin.from("stripe_invoices").select("stripe_invoice_id").eq("user_id", user.id).limit(1)
      : Promise.resolve({ data: [] as { stripe_invoice_id: string }[], error: null }),
    isAdminSession(supabase),
  ]);

  if (calculationsResult.error) {
    console.error("Failed to load calculations", calculationsResult.error);
  }
  if (customerResult.error) {
    console.error("Failed to load billing customer", customerResult.error);
  }
  if (invoiceResult.error) {
    console.error("Failed to load invoice history", invoiceResult.error);
  }
  if (profileResult.error) {
    console.error("Failed to load profile");
  }
  const hasInvoices =
    !customerResult.error &&
    Boolean(customerResult.data) &&
    !invoiceResult.error &&
    (invoiceResult.data?.length ?? 0) > 0;

  const calculations = (calculationsResult.data ?? []) as CalculationListRow[];

  const profile = profileResult.error ? emptyAccountProfile() : accountProfileFromRow(profileResult.data);

  return <AccountDashboard email={user.email} calculations={calculations} hasInvoices={hasInvoices} invoiceHint={invoiceHint} calculateUrl={calculateUrl} speicherOrigin={speicherOrigin} loadError={Boolean(calculationsResult.error)} isAdmin={isAdmin} profile={profile} profileStatus={profileStatus} />;
}
