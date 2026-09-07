import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import {
  getAuthCookieOptions,
  mergeAuthCookieOptions,
  resolveRequestHostname,
} from "@pv-auth/session";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return typeof url === "string" && url.length > 0 && typeof key === "string" && key.length > 0;
}

export async function createServerSupabaseClient(options?: { persistCookies?: boolean }) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const hostname = resolveRequestHostname(
    undefined,
    headerStore.get("host"),
    headerStore.get("x-forwarded-host"),
    headerStore.get("origin"),
  );
  const cookieOptions = getAuthCookieOptions(hostname);
  const persistCookies = options?.persistCookies === true;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          if (!persistCookies) return;
          try {
            cookiesToSet.forEach(({ name, value, options: cookieOpts }) =>
              cookieStore.set(name, value, mergeAuthCookieOptions(cookieOpts, hostname)),
            );
          } catch {
            // Server Component without mutable cookies.
          }
        },
      },
    },
  );
}
