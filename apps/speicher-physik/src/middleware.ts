import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  appendAuthCookiesFromSetAll,
  authCookieWriter,
  copySetCookieHeaders,
  getAuthCookieOptions,
  getHubLoginUrlForSpeicherCalculate,
  getHubLoginUrlForSpeicherResult,
  isPvNavigatorUuid,
  resolveRequestHostname,
} from "@pv-auth/session";

function isProtectedSpeicherPage(pathname: string): boolean {
  return (
    pathname === "/calculate" ||
    pathname.startsWith("/calculate/") ||
    pathname === "/result" ||
    pathname.startsWith("/result/")
  );
}

function loginUrlForPath(pathname: string): string {
  const match = /^\/result\/([^/]+)$/.exec(pathname);
  if (match && isPvNavigatorUuid(match[1])) {
    return getHubLoginUrlForSpeicherResult(match[1]);
  }
  return getHubLoginUrlForSpeicherCalculate();
}

function withCopiedCookies(from: NextResponse, to: NextResponse): NextResponse {
  copySetCookieHeaders(from.headers, to.headers);
  return to;
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const loginUrl = loginUrlForPath(request.nextUrl.pathname);
  const hostname = resolveRequestHostname(
    request.nextUrl.hostname,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.headers.get("origin"),
  );

  if (isProtectedSpeicherPage(request.nextUrl.pathname) && (!url || !key)) {
    return NextResponse.redirect(loginUrl);
  }

  if (!url || !key) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request,
  });

  const cookieOptions = getAuthCookieOptions(hostname);

  const supabase = createServerClient(url, key, {
    cookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        appendAuthCookiesFromSetAll(
          cookiesToSet,
          authCookieWriter(response.headers),
          hostname,
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedSpeicherPage(request.nextUrl.pathname) && !user) {
    return withCopiedCookies(response, NextResponse.redirect(loginUrl));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
