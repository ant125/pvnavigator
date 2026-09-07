import type { NextRequest } from "next/server";
import {
  AUTH_CATCH_PATH,
  decodeAuthHandoff,
  getSpeicherGrenzeCalculateUrl,
  getSpeicherGrenzeOrigin,
  isAllowedSessionHandoffRequest,
  isSupabaseAuthCookieName,
  serializeAuthSetCookie,
} from "@pv-auth/session";

import { hostnameFromAuthRequest } from "@/lib/supabase/routeHandler";
import { isSupabaseConfigured } from "@/lib/supabase/server";

function cookieHeaders(
  cookies: Array<{ name: string; value: string }>,
  hostname?: string,
): string[] {
  const headers: string[] = [];
  for (const cookie of cookies) {
    if (!isSupabaseAuthCookieName(cookie.name) || !cookie.value) continue;
    headers.push(
      serializeAuthSetCookie(cookie.name, cookie.value, hostname, { hostOnly: true }),
    );
    headers.push(serializeAuthSetCookie(cookie.name, cookie.value, hostname));
  }
  return headers;
}

function redirectWithCookies(location: string, setCookies: string[]): Response {
  const headers = new Headers();
  headers.set("Location", location);
  headers.set("Cache-Control", "no-store");
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 303, headers });
}

function failLocation(): string {
  return `${getSpeicherGrenzeOrigin()}${AUTH_CATCH_PATH}?error=1`;
}

async function cookiesFromRequest(
  request: NextRequest,
): Promise<Array<{ name: string; value: string }>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const handoff = decodeAuthHandoff(String(form.get("handoff") ?? ""));
    return handoff?.type === "cookies" ? handoff.cookies : [];
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return [];
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const handoff = decodeAuthHandoff(String(record?.handoff ?? ""));
  if (handoff?.type === "cookies") return handoff.cookies;
  return [];
}

export async function POST(request: NextRequest) {
  const hostname = hostnameFromAuthRequest(request);

  if (
    !isAllowedSessionHandoffRequest(
      request.headers.get("origin"),
      request.headers.get("referer"),
    )
  ) {
    return redirectWithCookies(failLocation(), []);
  }

  if (!isSupabaseConfigured()) {
    return redirectWithCookies(failLocation(), []);
  }

  const cookies = await cookiesFromRequest(request);
  if (cookies.length === 0) {
    return redirectWithCookies(failLocation(), []);
  }

  return redirectWithCookies(getSpeicherGrenzeCalculateUrl(), cookieHeaders(cookies, hostname));
}
