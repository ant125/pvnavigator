import { isPvNavigatorUuid } from "@pv-auth/session";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/admin";
import {
  parseAdminFeedbackList,
  parseAdminFeedbackThread,
  parseFeedbackThread,
  parseFeedbackThreads,
  type AdminFeedbackList,
  type AdminFeedbackThread,
  type FeedbackCalculationOption,
  type FeedbackThread,
  type FeedbackThreadSummary,
} from "@/lib/feedback";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LoadResult<T> = { status: "ok"; data: T } | { status: "error" };

export async function loadOwnFeedback(): Promise<
  LoadResult<{ threads: FeedbackThreadSummary[]; unread: number }>
> {
  const supabase = await createServerSupabaseClient();
  const [list, unread] = await Promise.all([
    supabase.rpc("list_feedback_threads"),
    supabase.rpc("feedback_unread_count"),
  ]);
  const threads = list.error ? null : parseFeedbackThreads(list.data);
  const count = typeof unread.data === "number" && Number.isInteger(unread.data) && unread.data >= 0
    ? unread.data
    : null;
  if (!threads || count === null || list.error || unread.error) {
    console.error("Failed to load feedback", list.error ?? unread.error);
    return { status: "error" };
  }
  return { status: "ok", data: { threads, unread: count } };
}

export async function loadOwnFeedbackUnread(): Promise<number | null> {
  const supabase = await createServerSupabaseClient();
  const unread = await supabase.rpc("feedback_unread_count");
  if (unread.error || typeof unread.data !== "number" || !Number.isInteger(unread.data) || unread.data < 0) {
    if (unread.error) console.error("Failed to count feedback replies", unread.error);
    return null;
  }
  return unread.data;
}

export async function loadOwnFeedbackThread(id: string): Promise<{ thread: FeedbackThread; wasUnread: boolean }> {
  if (!isPvNavigatorUuid(id)) notFound();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_feedback_thread", { p_thread_id: id });
  if (error?.code === "P0002" || error?.message?.includes("feedback_not_found")) notFound();
  const thread = error ? null : parseFeedbackThread(data);
  if (!thread || thread.id !== id.toLowerCase()) {
    console.error("Failed to load a feedback thread", error);
    throw new Error("feedback_unavailable");
  }
  let wasUnread = false;
  if (thread.unread) {
    const marked = await supabase.rpc("mark_feedback_read", { p_thread_id: thread.id });
    if (marked.error) console.error("Failed to mark feedback read", marked.error);
    else {
      wasUnread = true;
      thread.unread = false;
    }
  }
  return { thread, wasUnread };
}

export async function loadFeedbackCalculations(userId: string): Promise<FeedbackCalculationOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("calculations")
    .select("id, name, summary_address")
    .eq("user_id", userId)
    .eq("product_key", "speicher_grenze")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error || !data) {
    console.error("Failed to load calculations for feedback", error);
    return [];
  }
  const options: FeedbackCalculationOption[] = [];
  for (const row of data) {
    if (typeof row.id !== "string" || !isPvNavigatorUuid(row.id)) continue;
    const address = typeof row.summary_address === "string" ? row.summary_address.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    options.push({ id: row.id.toLowerCase(), label: address || name || "Gespeicherte Berechnung" });
  }
  return options;
}

export async function loadAdminFeedbackUnread(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("admin_feedback_unread_count");
  if (error || typeof data !== "number" || !Number.isInteger(data) || data < 0) {
    if (error) console.error("Failed to count unread feedback", error);
    return 0;
  }
  return data;
}

export async function loadAdminFeedbackList(page: number): Promise<LoadResult<AdminFeedbackList>> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("admin_list_feedback", { p_page: page, p_page_size: 20 });
  const list = error ? null : parseAdminFeedbackList(data);
  if (!list) {
    console.error("Failed to load administrator feedback", error);
    return { status: "error" };
  }
  return { status: "ok", data: list };
}

export async function loadAdminFeedbackThread(
  id: string,
): Promise<{ thread: AdminFeedbackThread; wasUnread: boolean } | null> {
  await requireAdmin();
  if (!isPvNavigatorUuid(id)) notFound();
  const supabase = await createServerSupabaseClient();
  const loaded = await supabase.rpc("admin_get_feedback", { p_thread_id: id });
  if (loaded.error?.code === "P0002" || loaded.error?.message?.includes("feedback_not_found")) return null;
  const thread = loaded.error ? null : parseAdminFeedbackThread(loaded.data);
  if (!thread || thread.id !== id.toLowerCase()) {
    console.error("Failed to load an administrator feedback thread", loaded.error);
    throw new Error("feedback_unavailable");
  }
  let wasUnread = false;
  if (thread.unread) {
    const marked = await supabase.rpc("admin_mark_feedback_read", { p_thread_id: thread.id });
    if (marked.error) console.error("Failed to mark administrator feedback read", marked.error);
    else {
      wasUnread = true;
      thread.unread = false;
    }
  }
  return { thread, wasUnread };
}
