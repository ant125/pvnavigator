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

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const hostname = resolveRequestHostname(
    undefined,
    headerStore.get("host"),
    headerStore.get("x-forwarded-host"),
  );
  const cookieOptions = getAuthCookieOptions(hostname);

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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, mergeAuthCookieOptions(options, hostname)),
            );
          } catch {
            // Called from a Server Component without mutable cookies — middleware keeps session fresh.
          }
        },
      },
    },
  );
}
