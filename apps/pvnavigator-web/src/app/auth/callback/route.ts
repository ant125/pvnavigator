import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createRouteHandlerSupabase, redirectWithSetCookies } from "@/lib/supabase/routeHandler";
import { isSupabaseConfigured } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function sameOrigin(request: NextRequest, path: string): string {
  return new URL(path, request.url).toString();
}

function parseEmailOtpType(raw: string | null): EmailOtpType | null {
  if (!raw || !EMAIL_OTP_TYPES.has(raw as EmailOtpType)) return null;
  return raw as EmailOtpType;
}

export async function GET(request: NextRequest) {
  const success = sameOrigin(request, "/auth/bestaetigt");
  const failure = sameOrigin(request, "/auth/bestaetigt?error=exchange_failed");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(failure, 303);
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const otpType = parseEmailOtpType(request.nextUrl.searchParams.get("type"));

  const setCookies: string[] = [];
  const { supabase } = createRouteHandlerSupabase(request, setCookies);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return redirectWithSetCookies(failure, setCookies);
      }
    }
    return redirectWithSetCookies(success, setCookies);
  }

  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    if (error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return redirectWithSetCookies(failure, setCookies);
      }
    }
    return redirectWithSetCookies(success, setCookies);
  }

  return NextResponse.redirect(failure, 303);
}
