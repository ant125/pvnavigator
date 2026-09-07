"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getAuthCookieOptions } from "@pv-auth/session";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getAuthCookieOptions(
        typeof window !== "undefined" ? window.location.hostname : undefined,
      ),
    },
  );
}
