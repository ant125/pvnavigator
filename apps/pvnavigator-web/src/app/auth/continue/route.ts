import { NextResponse, type NextRequest } from "next/server";
import { getHubOrigin, parseAuthNextParam, resolvePostLoginRedirect } from "@pv-auth/session";

export async function GET(request: NextRequest) {
  const next = parseAuthNextParam(request.nextUrl.searchParams.get("next"), "/");
  const dest = resolvePostLoginRedirect(next, "/");
  const location = dest.startsWith("http")
    ? dest
    : new URL(dest, `${getHubOrigin()}/`).toString();
  return NextResponse.redirect(location, 303);
}
