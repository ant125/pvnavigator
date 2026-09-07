import type { NextRequest } from "next/server";
import { getHubOrigin, isAllowedSessionHandoffOrigin } from "@pv-auth/session";

import { createRouteHandlerSupabase } from "@/lib/supabase/routeHandler";
import { isSupabaseConfigured } from "@/lib/supabase/server";

const TOKEN_MAX_LENGTH = 16_384;

function corsHeaders(): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", getHubOrigin());
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type");
  headers.set("Access-Control-Max-Age", "600");
  headers.set("Cache-Control", "no-store");
  headers.set("Vary", "Origin");
  return headers;
}

function isPlausibleToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 16 &&
    value.length <= TOKEN_MAX_LENGTH &&
    !/\s/.test(value)
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders();

  if (!isAllowedSessionHandoffOrigin(request.headers.get("origin"))) {
    return new Response(null, { status: 403, headers });
  }

  if (!isSupabaseConfigured()) {
    return new Response(null, { status: 503, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400, headers });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const accessToken = record?.access_token;
  const refreshToken = record?.refresh_token;

  if (!isPlausibleToken(accessToken) || !isPlausibleToken(refreshToken)) {
    return new Response(null, { status: 400, headers });
  }

  const setCookies: string[] = [];
  const { supabase } = createRouteHandlerSupabase(request, setCookies);
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return new Response(null, { status: 401, headers });
  }

  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 204, headers });
}
