import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  appendAuthCookiesFromSetAll,
  authCookieWriter,
  copySetCookieHeaders,
  getAuthCookieOptions,
  getHubOrigin,
  isHubAuthMutationPath,
  parseAuthNextParam,
  resolvePostLoginRedirect,
  resolveRequestHostname,
} from "@pv-auth/session";

function withCopiedCookies(from: NextResponse, to: NextResponse): NextResponse {
  copySetCookieHeaders(from.headers, to.headers);
  return to;
}

export async function middleware(request: NextRequest) {
  if (isHubAuthMutationPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
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

  if (request.method === "GET" && request.nextUrl.pathname === "/anmelden" && user) {
    const nextParam = parseAuthNextParam(
      request.nextUrl.searchParams.get("next"),
      "/konto",
    );
    const dest = resolvePostLoginRedirect(nextParam, "/konto");
    const location = dest.startsWith("http")
      ? dest
      : new URL(dest, `${getHubOrigin()}/`).toString();
    return withCopiedCookies(response, NextResponse.redirect(location));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
