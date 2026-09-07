import type { NextRequest } from "next/server";
import {
  isAllowedSessionHandoffRequest,
  isSupabaseAuthCookieName,
  serializeAuthSetCookie,
} from "@pv-auth/session";

import { createRouteHandlerSupabase, hostnameFromAuthRequest } from "@/lib/supabase/routeHandler";
import { isSupabaseConfigured } from "@/lib/supabase/server";

const TOKEN_MAX_LENGTH = 100_000;
const MAX_HANDOFF_COOKIES = 8;

function asToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > TOKEN_MAX_LENGTH) return null;
  return trimmed;
}

function readCookieList(value: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(value)) return [];
  const cookies: Array<{ name: string; value: string }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const name = (entry as { name?: unknown }).name;
    const cookieValue = (entry as { value?: unknown }).value;
    if (typeof name !== "string" || typeof cookieValue !== "string") continue;
    if (!isSupabaseAuthCookieName(name) || !cookieValue) continue;
    cookies.push({ name, value: cookieValue });
    if (cookies.length >= MAX_HANDOFF_COOKIES) break;
  }
  return cookies;
}

function jsonResponse(ok: boolean, status: number, setCookies: string[] = []): Response {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("cache-control", "no-store");
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(JSON.stringify({ ok }), { status, headers });
}

export async function POST(request: NextRequest) {
  if (
    !isAllowedSessionHandoffRequest(
      request.headers.get("origin"),
      request.headers.get("referer"),
    )
  ) {
    return jsonResponse(false, 403);
  }

  if (!isSupabaseConfigured()) {
    return jsonResponse(false, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(false, 400);
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const cookies = readCookieList(record?.cookies);
  const hostname = hostnameFromAuthRequest(request);

  if (cookies.length > 0) {
    const setCookies = cookies.map((cookie) =>
      serializeAuthSetCookie(cookie.name, cookie.value, hostname),
    );
    return jsonResponse(true, 200, setCookies);
  }

  const accessToken = asToken(record?.access_token);
  const refreshToken = asToken(record?.refresh_token);
  if (!accessToken || !refreshToken) {
    return jsonResponse(false, 400);
  }

  const setCookies: string[] = [];
  const { supabase } = createRouteHandlerSupabase(request, setCookies);
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return jsonResponse(false, 401);
  }

  return jsonResponse(true, 200, setCookies);
}
