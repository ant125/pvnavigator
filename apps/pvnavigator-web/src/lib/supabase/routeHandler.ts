import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  appendAuthCookiesFromSetAll,
  getAuthCookieOptions,
  resolveRequestHostname,
} from "@pv-auth/session";

export function hostnameFromAuthRequest(request: NextRequest): string | undefined {
  return resolveRequestHostname(
    request.nextUrl.hostname,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.headers.get("origin"),
  );
}

export function createRouteHandlerSupabase(
  request: NextRequest,
  setCookies: string[],
) {
  const hostname = hostnameFromAuthRequest(request);
  const cookieOptions = getAuthCookieOptions(hostname);
  const writer = {
    appendHeader: (_name: string, value: string) => {
      setCookies.push(value);
    },
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          appendAuthCookiesFromSetAll(cookiesToSet, writer, hostname);
        },
      },
    },
  );

  return { supabase, hostname };
}

export function redirectWithSetCookies(location: string, setCookies: string[]): NextResponse {
  const response = NextResponse.redirect(location, 303);
  response.headers.set("Cache-Control", "no-store");
  for (const cookie of setCookies) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
