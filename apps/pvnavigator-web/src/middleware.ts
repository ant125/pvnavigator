import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthCookieOptions,
  mergeAuthCookieOptions,
  rehomeAuthCookiesToParentDomain,
  resolveRequestHostname,
} from "@pv-auth/session";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const hostname = resolveRequestHostname(
    request.nextUrl.hostname,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
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

  await supabase.auth.getUser();

  rehomeAuthCookiesToParentDomain(
    request.cookies.getAll(),
    {
      appendHeader: (name, value) => {
        response.headers.append(name, value);
      },
      setCookie: (name, value, options) => {
        response.cookies.set(name, value, options);
      },
    },
    hostname,
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
