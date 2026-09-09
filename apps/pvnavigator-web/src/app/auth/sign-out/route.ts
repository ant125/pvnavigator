import { NextResponse, type NextRequest } from "next/server";
import {
  expireAuthCookiesForLogout,
  getHubOrigin,
  isAllowedHubSignOutOrigin,
  resolvePostLogoutLocation,
} from "@pv-auth/session";

import { createRouteHandlerSupabase, redirectWithSetCookies } from "@/lib/supabase/routeHandler";
import { isSupabaseConfigured } from "@/lib/supabase/server";

function homeRedirect(setCookies: string[] = []) {
  return redirectWithSetCookies(new URL("/", getHubOrigin()).toString(), setCookies);
}

export async function GET() {
  return NextResponse.redirect(new URL("/", getHubOrigin()), 303);
}

export async function POST(request: NextRequest) {
  if (
    !isAllowedHubSignOutOrigin(
      request.headers.get("origin"),
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
      request.nextUrl.origin,
    )
  ) {
    return homeRedirect();
  }

  const setCookies: string[] = [];
  if (isSupabaseConfigured()) {
    const { supabase, hostname } = createRouteHandlerSupabase(request, setCookies);
    await supabase.auth.signOut();
    expireAuthCookiesForLogout(
      request.cookies.getAll(),
      {
        appendHeader: (_name, value) => {
          setCookies.push(value);
        },
      },
      hostname,
    );
  }

  const dest = resolvePostLogoutLocation(
    request.nextUrl.searchParams.get("returnTo"),
  );
  return redirectWithSetCookies(dest, setCookies);
}
