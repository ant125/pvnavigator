"use server";

import { readOwnTrustpilotSession } from "@/lib/trustpilotInvitationServer";

export type TrustpilotClickResult = "saved" | "failed";

/** Records the first display. A later call does not move the timestamp. */
export async function recordTrustpilotShown(): Promise<void> {
  const session = await readOwnTrustpilotSession();
  if (!session?.state.show || !session.state.recordShown) return;
  const { error } = await session.supabase
    .from("profiles")
    .update({ trustpilot_shown_at: new Date().toISOString() })
    .eq("id", session.userId)
    .is("trustpilot_shown_at", null);
  if (error) {
    console.error("Failed to record the Trustpilot invitation", error.message);
  }
}

/**
 * Records the first opening of the Trustpilot link.
 * Returns "failed" when the timestamp was not stored. The caller still opens the link.
 */
export async function recordTrustpilotClick(): Promise<TrustpilotClickResult> {
  const session = await readOwnTrustpilotSession();
  if (!session?.state.show) return "failed";

  const stamp = new Date().toISOString();
  const updated = await session.supabase
    .from("profiles")
    .update({
      trustpilot_clicked_at: stamp,
      trustpilot_shown_at: stamp,
    })
    .eq("id", session.userId)
    .is("trustpilot_clicked_at", null)
    .select("trustpilot_clicked_at")
    .maybeSingle();

  if (updated.error) {
    console.error("Failed to record the Trustpilot click", updated.error.message);
    return "failed";
  }
  if (typeof updated.data?.trustpilot_clicked_at === "string") return "saved";

  const existing = await session.supabase
    .from("profiles")
    .select("trustpilot_clicked_at")
    .eq("id", session.userId)
    .maybeSingle();
  if (existing.error || typeof existing.data?.trustpilot_clicked_at !== "string") {
    return "failed";
  }
  return "saved";
}
