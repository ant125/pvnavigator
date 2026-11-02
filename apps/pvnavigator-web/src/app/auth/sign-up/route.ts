import { NextResponse, type NextRequest } from "next/server";
import { getHubOrigin, isAllowedHubFormOrigin } from "@pv-auth/session";

import {
  getEmailConfirmationRedirectUrl,
  hubPostLoginLocation,
  hubSignUpConfirmUrl,
  hubSignUpErrorUrl,
  mapSupabaseAuthErrorToSignUpCode,
} from "@/lib/auth";
import {
  createRouteHandlerSupabase,
  expireLegacyCookiesOn,
  redirectWithSetCookies,
} from "@/lib/supabase/routeHandler";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  return NextResponse.redirect(new URL("/konto-erstellen", getHubOrigin()), 303);
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
    return NextResponse.redirect(hubSignUpErrorUrl("generic", next), 303);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(hubSignUpErrorUrl("config", next), 303);
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");

  if (!email || !password) {
    return NextResponse.redirect(hubSignUpErrorUrl("missing", next), 303);
  }

  if (password !== passwordConfirm) {
    return NextResponse.redirect(hubSignUpErrorUrl("mismatch", next), 303);
  }

  const setCookies: string[] = [];
  const { supabase } = createRouteHandlerSupabase(request, setCookies);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getEmailConfirmationRedirectUrl(),
    },
  });

  if (error) {
    return NextResponse.redirect(
      hubSignUpErrorUrl(mapSupabaseAuthErrorToSignUpCode(error), next),
      303,
    );
  }

  if (data.session) {
    expireLegacyCookiesOn(request, setCookies);
    return redirectWithSetCookies(hubPostLoginLocation(next), setCookies);
  }

  return redirectWithSetCookies(hubSignUpConfirmUrl(), setCookies);
}
