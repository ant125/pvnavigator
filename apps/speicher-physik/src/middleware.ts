import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  authCookieWriter,
  copySetCookieHeaders,
  getAuthCookieOptions,
  getHubLoginUrlForSpeicherCalculate,
  mergeAuthCookieOptions,
  rehomeAuthCookiesToParentDomain,
  resolveRequestHostname,
} from "@pv-auth/session";

function isProtectedCalculatePage(pathname: string): boolean {
  return pathname === "/calculate" || pathname.startsWith("/calculate/");
}

function applyAuthCookies(request: NextRequest, response: NextResponse, hostname?: string) {
  rehomeAuthCookiesToParentDomain(
    request.cookies.getAll(),
    authCookieWriter(response.headers),
    hostname,
  );
}

function withCopiedCookies(from: NextResponse, to: NextResponse): NextResponse {
  copySetCookieHeaders(from.headers, to.headers);
  return to;
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const loginUrl = getHubLoginUrlForSpeicherCalculate();
  const hostname = resolveRequestHostname(
    request.nextUrl.hostname,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.headers.get("origin"),
  );

  if (isProtectedCalculatePage(request.nextUrl.pathname) && (!url || !key)) {
    return NextResponse.redirect(loginUrl);
  }

  if (!url || !key) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
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
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, mergeAuthCookieOptions(options, hostname)),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedCalculatePage(request.nextUrl.pathname) && !user) {
    const redirectResponse = withCopiedCookies(response, NextResponse.redirect(loginUrl));
    applyAuthCookies(request, redirectResponse, hostname);
    return redirectResponse;
  }

  applyAuthCookies(request, response, hostname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
