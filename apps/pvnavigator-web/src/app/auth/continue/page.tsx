import type { Metadata } from "next";
import {
  getHubOrigin,
  getSpeicherGrenzeCalculateUrl,
  parseAuthNextParam,
  resolvePostLoginRedirect,
} from "@pv-auth/session";

import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { ContinueClient } from "./ContinueClient";

export const metadata: Metadata = {
  title: "Weiterleitung | PVNavigator",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string | string[] }>;

export default async function ContinuePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = parseAuthNextParam(Array.isArray(sp.next) ? sp.next[0] : sp.next, "/konto");
  const dest = resolvePostLoginRedirect(next, "/konto");
  const hub = getHubOrigin();
  const location = dest.startsWith("http")
    ? dest
    : new URL(dest, `${hub}/`).toString();
  const allowed =
    location === getSpeicherGrenzeCalculateUrl() || location.startsWith(`${hub}/`);

  let accessToken = "";
  let refreshToken = "";
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? "";
    refreshToken = data.session?.refresh_token ?? "";
  }

  return (
    <ContinueClient
      dest={allowed ? location : `${hub}/konto`}
      accessToken={accessToken}
      refreshToken={refreshToken}
    />
  );
}
