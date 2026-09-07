import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  encodeAuthCookieHandoff,
  getHubOrigin,
  getSpeicherGrenzeCalculateUrl,
  isSupabaseAuthCookieName,
  parseAuthNextParam,
  resolvePostLoginRedirect,
} from "@pv-auth/session";

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

  const cookieStore = await cookies();
  const payload = encodeAuthCookieHandoff(
    cookieStore.getAll().filter((cookie) => isSupabaseAuthCookieName(cookie.name) && cookie.value),
  );

  return (
    <ContinueClient dest={allowed ? location : `${hub}/konto`} payload={payload} />
  );
}
