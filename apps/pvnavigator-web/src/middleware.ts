import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  authCookieWriter,
  copySetCookieHeaders,
  getAuthCookieOptions,
  getHubOrigin,
  hasSupabaseAuthCookie,
  mergeAuthCookieOptions,
  parseAuthNextParam,
  rehomeAuthCookiesToParentDomain,
  resolvePostLoginRedirect,
  resolveRequestHostname,
  supabaseProjectRefFromUrl,
} from "@pv-auth/session";

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
    "app=hub",
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

  if (!url || !key) {
    const response = NextResponse.next();
    response.headers.set(
      "x-pv-auth-diag",
      diagHeader({
        host: resolveRequestHostname(
          request.nextUrl.hostname,
          request.headers.get("host"),
          request.headers.get("x-forwarded-host"),
          request.headers.get("origin"),
        ),
        userResolved: false,
        cookiePresent: hasSupabaseAuthCookie(request.cookies.getAll()),
      }),
    );
    return response;
  }

  let response = NextResponse.next({
    request,
  });

  const hostname = resolveRequestHostname(
    request.nextUrl.hostname,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.headers.get("origin"),
  );
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

  if (request.method === "GET" && request.nextUrl.pathname === "/anmelden" && user) {
    const dest = resolvePostLoginRedirect(
      parseAuthNextParam(request.nextUrl.searchParams.get("next"), "/"),
      "/konto",
    );
    const location = dest.startsWith("http")
      ? dest
      : new URL(dest, `${getHubOrigin()}/`).toString();
    const redirectResponse = withCopiedCookies(response, NextResponse.redirect(location));
    applyAuthCookies(request, redirectResponse, hostname);
    redirectResponse.headers.set(
      "x-pv-auth-diag",
      diagHeader({
        host: hostname,
        userResolved: true,
        cookiePresent: hasSupabaseAuthCookie(request.cookies.getAll()),
      }),
    );
    return redirectResponse;
  }

  applyAuthCookies(request, response, hostname);
  response.headers.set(
    "x-pv-auth-diag",
    diagHeader({
      host: hostname,
      userResolved: Boolean(user),
      cookiePresent: hasSupabaseAuthCookie(request.cookies.getAll()),
    }),
  );
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
