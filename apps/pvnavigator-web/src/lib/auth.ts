import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Same-origin relative paths only; blocks protocol-relative and absolute URLs.
 */
export function sanitizeNextPath(raw: unknown, fallback = "/konto"): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (trimmed.toLowerCase().startsWith("/\\")) return fallback;
  return trimmed || fallback;
}

export async function getServerUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
