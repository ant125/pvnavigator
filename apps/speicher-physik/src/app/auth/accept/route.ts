import type { NextRequest } from "next/server";
import {
  getHubLoginUrlForSpeicherCalculate,
  getSpeicherGrenzeCalculateUrl,
  isAllowedSessionHandoffRequest,
} from "@pv-auth/session";

import { createRouteHandlerSupabase } from "@/lib/supabase/routeHandler";
import { isSupabaseConfigured } from "@/lib/supabase/server";

const TOKEN_MAX_LENGTH = 100_000;

function asToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > TOKEN_MAX_LENGTH) return null;
  return trimmed;
}

async function readSessionTokens(
  request: NextRequest,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const accessToken = asToken(form.get("access_token"));
    const refreshToken = asToken(form.get("refresh_token"));
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const accessToken = asToken(record?.access_token);
  const refreshToken = asToken(record?.refresh_token);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

function redirectToCalculate(setCookies: string[]): Response {
  const headers = new Headers();
  headers.set("Location", getSpeicherGrenzeCalculateUrl());
  headers.set("Cache-Control", "no-store");
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 303, headers });
}

export async function POST(request: NextRequest) {
  const loginUrl = getHubLoginUrlForSpeicherCalculate();

  if (
    !isAllowedSessionHandoffRequest(
      request.headers.get("origin"),
      request.headers.get("referer"),
    )
  ) {
    return new Response(null, { status: 303, headers: { Location: loginUrl } });
  }

  if (!isSupabaseConfigured()) {
    return new Response(null, { status: 303, headers: { Location: loginUrl } });
  }

  const tokens = await readSessionTokens(request);
  if (!tokens) {
    return new Response(null, { status: 303, headers: { Location: loginUrl } });
  }

  const setCookies: string[] = [];
  const { supabase } = createRouteHandlerSupabase(request, setCookies);
  const { error } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  if (error) {
    return new Response(null, { status: 303, headers: { Location: loginUrl } });
  }

  return redirectToCalculate(setCookies);
}
