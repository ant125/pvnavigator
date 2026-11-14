import { getServerUser } from "@/lib/auth";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

import {
  trustpilotInvitationForAccount,
  type TrustpilotInvitationState,
} from "./trustpilotInvitation";

const hidden: TrustpilotInvitationState = { show: false, recordShown: false };

type TrustpilotSession = {
  userId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  state: TrustpilotInvitationState;
};

/** Reads the signed-in account's own type, saved calculations, and stamps. */
export async function readOwnTrustpilotSession(): Promise<TrustpilotSession | null> {
  const user = await getServerUser();
  if (!user || !isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const [profile, calculations] = await Promise.all([
    supabase
      .from("profiles")
      .select("account_kind, trustpilot_shown_at, trustpilot_clicked_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("calculations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);
  if (profile.error) {
    console.error("Failed to read the Trustpilot invitation", profile.error.message);
  }
  if (calculations.error) {
    console.error("Failed to count saved calculations for Trustpilot", calculations.error.message);
  }
  return {
    userId: user.id,
    supabase,
    state: trustpilotInvitationForAccount({
      accountKind: profile.data?.account_kind,
      savedCalculations: calculations.count,
      trustpilotShownAt: profile.data?.trustpilot_shown_at,
      trustpilotClickedAt: profile.data?.trustpilot_clicked_at,
      error: Boolean(profile.error || calculations.error || !profile.data),
    }),
  };
}

export async function readOwnTrustpilotInvitation(): Promise<TrustpilotInvitationState> {
  const session = await readOwnTrustpilotSession();
  return session?.state ?? hidden;
}
