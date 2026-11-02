import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getHubOrigin, isAllowedHubFormOrigin } from "@pv-auth/session";
import type { PaidPlanId } from "@pv-access/core";

export function billingFormAllowed(request: NextRequest): boolean {
  return isAllowedHubFormOrigin(
    request.headers.get("origin"),
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.nextUrl.origin,
  );
}

export function redirectTarife(hint?: string): NextResponse {
  const url = new URL("/tarife", getHubOrigin());
  if (hint) url.searchParams.set("hinweis", hint);
  return NextResponse.redirect(url, 303);
}

export function redirectLoginForTariff(plan: PaidPlanId = "abo"): NextResponse {
  const url = new URL("/anmelden", getHubOrigin());
  url.searchParams.set("next", `/tarife?auswahl=${plan}`);
  return NextResponse.redirect(url, 303);
}

export function redirectKonto(hint?: string): NextResponse {
  const url = new URL("/konto", getHubOrigin());
  if (hint) url.searchParams.set("hinweis", hint);
  return NextResponse.redirect(url, 303);
}

export function redirectLoginForKonto(): NextResponse {
  const url = new URL("/anmelden", getHubOrigin());
  url.searchParams.set("next", "/konto");
  return NextResponse.redirect(url, 303);
}
