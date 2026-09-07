import { NextResponse, type NextRequest } from "next/server";
import { getHubOrigin, isAllowedHubFormOrigin } from "@pv-auth/session";

import {
  hubPostLoginLocation,
  hubSignInErrorUrl,
  mapSupabaseAuthErrorToSignInCode,
} from "@/lib/auth";
import {
  createRouteHandlerSupabase,
  expireLegacyCookiesOn,
  redirectWithSetCookies,
} from "@/lib/supabase/routeHandler";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  return NextResponse.redirect(new URL("/anmelden", getHubOrigin()), 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const next = formData.get("next");

  if (
    !isAllowedHubFormOrigin(
      request.headers.get("origin"),
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
      request.nextUrl.origin,
    )
  ) {
    return NextResponse.redirect(hubSignInErrorUrl("generic", next), 303);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(hubSignInErrorUrl("config", next), 303);
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return NextResponse.redirect(hubSignInErrorUrl("missing", next), 303);
  }

  const setCookies: string[] = [];
  const { supabase } = createRouteHandlerSupabase(request, setCookies);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.redirect(
      hubSignInErrorUrl(mapSupabaseAuthErrorToSignInCode(error), next),
      303,
    );
  }

  expireLegacyCookiesOn(request, setCookies);
  return redirectWithSetCookies(hubPostLoginLocation(next), setCookies);
}
