"use client";

import { getSpeicherGrenzeOrigin, rehomeReadableAuthCookiesInBrowser } from "@pv-auth/session";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Move the hub session onto `.pvnavigator.de` and ask SpeicherGrenze to
 * persist the same session. Does not log tokens.
 */
export async function handoffSessionToSpeicherGrenze(): Promise<void> {
  let accessToken: string | undefined;
  let refreshToken: string | undefined;

  try {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
    refreshToken = data.session?.refresh_token;
  } catch {
    // Continue with cookie rehome even if getSession fails.
  }

  await rehomeReadableAuthCookiesInBrowser();

  if (!accessToken || !refreshToken) return;

  try {
    await fetch(`${getSpeicherGrenzeOrigin()}/auth/accept`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
      }),
    });
  } catch {
    // Navigation still proceeds; SpeicherGrenze may already have the cookie.
  }
}
