import { NextResponse, type NextRequest } from "next/server";
import { getHubOrigin, isAllowedHubFormOrigin } from "@pv-auth/session";

import { parseAccountProfileFields } from "@/lib/accountProfile";
import { createRouteHandlerSupabase } from "@/lib/supabase/routeHandler";
import { isSupabaseConfigured } from "@/lib/supabase/server";

function profileUrl(status: "gespeichert" | "ungueltig" | "anmelden"): URL {
  if (status === "anmelden") {
    const url = new URL("/anmelden", getHubOrigin());
    url.searchParams.set("next", "/konto");
    return url;
  }
  const url = new URL("/konto", getHubOrigin());
  url.searchParams.set("profil", status);
  url.hash = "profil";
  return url;
}

export async function POST(request: NextRequest) {
  if (
    !isAllowedHubFormOrigin(
      request.headers.get("origin"),
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
      request.nextUrl.origin,
    )
  ) {
    return NextResponse.redirect(profileUrl("ungueltig"), 303);
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(profileUrl("ungueltig"), 303);
  }

  const formData = await request.formData();
  const profile = parseAccountProfileFields({
    accountKind: formData.get("account_kind"),
    givenName: formData.get("given_name"),
    familyName: formData.get("family_name"),
    companyName: formData.get("company_name"),
  });
  if (!profile) return NextResponse.redirect(profileUrl("ungueltig"), 303);

  const { supabase } = createRouteHandlerSupabase(request, []);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.redirect(profileUrl("anmelden"), 303);

  const { error } = await supabase.from("profiles").update({
    account_kind: profile.accountKind,
    given_name: profile.givenName,
    family_name: profile.familyName,
    company_name: profile.companyName,
  }).eq("id", userData.user.id);

  if (error) {
    console.error("Failed to save profile");
    return NextResponse.redirect(profileUrl("ungueltig"), 303);
  }
  return NextResponse.redirect(profileUrl("gespeichert"), 303);
}
