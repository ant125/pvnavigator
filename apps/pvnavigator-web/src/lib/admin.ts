import type { User } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { cache } from "react";

import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

type RoleCheckClient = {
  rpc(fn: "is_admin"): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Asks the database whether the session behind this client is an administrator.
 * `public.is_admin()` reads `auth.uid()` from the request's JWT, so the answer
 * cannot be influenced by anything the browser sends besides its own session.
 * A failed check counts as "no".
 */
export async function isAdminSession(supabase: RoleCheckClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("Failed to check the administrator role", error);
    return false;
  }
  return data === true;
}

/** The signed-in user when the account is an administrator, otherwise `null`. */
export const getAdminUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return (await isAdminSession(supabase)) ? user : null;
});

/**
 * Guard for everything under `/admin`. Visitors, signed-in non-administrators
 * and failed checks all get the same 404.
 * Call it in every admin page and route handler, not only in the layout:
 * a layout does not run again on client-side navigation between its pages.
 */
export async function requireAdmin(): Promise<User> {
  const user = await getAdminUser();
  if (!user) notFound();
  return user;
}
