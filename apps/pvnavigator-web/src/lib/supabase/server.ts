import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { getAuthCookieOptions, resolveRequestHostname } from "@pv-auth/session";

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
    headerStore.get("origin"),
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
        setAll() {
          // Cookie writes belong to Route Handlers with raw
          // Domain=.pvnavigator.de Set-Cookie. cookies().set() is host-only.
        },
      },
    },
  );
}
