import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  authCookieWriter,
  copySetCookieHeaders,
  getAuthCookieOptions,
  getHubLoginUrlForSpeicherCalculate,
  hasSupabaseAuthCookie,
  mergeAuthCookieOptions,
  rehomeAuthCookiesToParentDomain,
  resolveRequestHostname,
  supabaseProjectRefFromUrl,
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

function diagHeader(input: {
  host?: string;
  userResolved: boolean;
  cookiePresent: boolean;
}): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const domain = getAuthCookieOptions(input.host).domain;
  const ref = supabaseProjectRefFromUrl(url);
  return [
    "app=speicher",
    `host=${input.host ?? ""}`,
    `url=${url ? "1" : "0"}`,
    `key=${key ? "1" : "0"}`,
    `domainCfg=${process.env.AUTH_COOKIE_DOMAIN || process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN ? "1" : "0"}`,
    `domain=${domain ? "parent" : "host"}`,
    `ref=${ref === "ftxgcpebzrhvifjnjivm" ? "1" : "0"}`,
    `cookie=${input.cookiePresent ? "1" : "0"}`,
    `user=${input.userResolved ? "1" : "0"}`,
    "mw=1",
  ].join(";");
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
  const cookiePresent = hasSupabaseAuthCookie(request.cookies.getAll());

  if (isProtectedCalculatePage(request.nextUrl.pathname) && (!url || !key)) {
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set(
      "x-pv-auth-diag",
      diagHeader({ host: hostname, userResolved: false, cookiePresent }),
    );
    return redirectResponse;
  }

  if (!url || !key) {
    const response = NextResponse.next();
    response.headers.set(
      "x-pv-auth-diag",
      diagHeader({ host: hostname, userResolved: false, cookiePresent }),
    );
    return response;
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
    redirectResponse.headers.set(
      "x-pv-auth-diag",
      diagHeader({ host: hostname, userResolved: false, cookiePresent }),
    );
    return redirectResponse;
  }

  applyAuthCookies(request, response, hostname);
  response.headers.set(
    "x-pv-auth-diag",
    diagHeader({
      host: hostname,
      userResolved: Boolean(user),
      cookiePresent,
    }),
  );
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
