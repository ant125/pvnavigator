import { accountProfileFromRow, emptyAccountProfile, type AccountProfileView } from "@/lib/accountProfile";
import { isAdminSession } from "@/lib/admin";
import { CALCULATION_LIST_SELECT, type CalculationListRow } from "@/lib/calculationsList";
import { loadOwnFeedback } from "@/lib/feedbackServer";
import type { FeedbackThreadSummary } from "@/lib/feedback";
import { readOwnTrustpilotInvitation } from "@/lib/trustpilotInvitationServer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export type AccountWorkspace = {
  calculations: CalculationListRow[];
  loadError: boolean;
  profile: AccountProfileView;
  hasInvoices: boolean;
  isAdmin: boolean;
  trustpilotShow: boolean;
  trustpilotRecordShown: boolean;
  feedbackThreads: FeedbackThreadSummary[];
  feedbackUnread: number | null;
  feedbackError: boolean;
};

export async function loadAccountProfile(userId: string): Promise<AccountProfileView> {
  const supabase = await createServerSupabaseClient();
  const profileResult = await supabase.from("profiles").select("account_kind, given_name, family_name, company_name").eq("id", userId).maybeSingle();
  if (profileResult.error) {
    console.error("Failed to load profile");
    return emptyAccountProfile();
  }
  return accountProfileFromRow(profileResult.data);
}

export async function loadAccountWorkspace(userId: string): Promise<AccountWorkspace> {
  const supabase = await createServerSupabaseClient();
  const admin = createServiceRoleClient();
  const loadCalculations = async () => {
    const rows: CalculationListRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from("calculations").select(CALCULATION_LIST_SELECT)
        .eq("user_id", userId).order("updated_at", { ascending: false })
        .order("id", { ascending: true }).range(offset, offset + 499);
      if (result.error) return { data: null, error: result.error };
      rows.push(...(result.data as unknown as CalculationListRow[]));
      if (result.data.length < 500) return { data: rows, error: null };
    }
  };
  const [calculationsResult, profileResult, customerResult, invoiceResult, isAdmin, trustpilot, feedback] = await Promise.all([
    loadCalculations(),
    supabase.from("profiles").select("account_kind, given_name, family_name, company_name").eq("id", userId).maybeSingle(),
    supabase.from("stripe_customers").select("user_id").maybeSingle(),
    admin
      ? admin.from("stripe_invoices").select("stripe_invoice_id").eq("user_id", userId).limit(1)
      : Promise.resolve({ data: [] as { stripe_invoice_id: string }[], error: null }),
    isAdminSession(supabase),
    readOwnTrustpilotInvitation(),
    loadOwnFeedback(),
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

  return {
    calculations: (calculationsResult.data ?? []) as CalculationListRow[],
    loadError: Boolean(calculationsResult.error),
    profile: profileResult.error ? emptyAccountProfile() : accountProfileFromRow(profileResult.data),
    hasInvoices,
    isAdmin,
    trustpilotShow: trustpilot.show,
    trustpilotRecordShown: trustpilot.recordShown,
    feedbackThreads: feedback.status === "ok" ? feedback.data.threads : [],
    feedbackUnread: feedback.status === "ok" ? feedback.data.unread : null,
    feedbackError: feedback.status !== "ok",
  };
}
