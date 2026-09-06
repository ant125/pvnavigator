import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function getServerUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
