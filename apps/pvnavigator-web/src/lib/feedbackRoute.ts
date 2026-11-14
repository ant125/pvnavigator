import { getHubOrigin, isAllowedHubFormOrigin, isPvNavigatorUuid } from "@pv-auth/session";
import type { NextRequest } from "next/server";

import { feedbackErrorCode, parseFeedbackDraft, parseFeedbackStatus } from "@/lib/feedback";
import { createRouteHandlerSupabase, redirectWithSetCookies } from "@/lib/supabase/routeHandler";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export function feedbackLocation(path: string, hint?: string): string {
  const url = new URL(path, `${getHubOrigin()}/`);
  if (hint) url.searchParams.set("hinweis", hint);
  return url.toString();
}

export function feedbackRedirect(path: string, setCookies: string[], hint?: string) {
  return redirectWithSetCookies(feedbackLocation(path, hint), setCookies);
}

function formValue(formData: FormData, key: string): unknown {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

export async function readFeedbackPost(request: NextRequest, nextPath: string): Promise<
  | { ok: false; response: Response }
  | {
      ok: true;
      formData: FormData;
      setCookies: string[];
      supabase: ReturnType<typeof createRouteHandlerSupabase>["supabase"];
    }
> {
  const setCookies: string[] = [];
  if (
    !isAllowedHubFormOrigin(
      request.headers.get("origin"),
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
      request.nextUrl.origin,
    )
    || !isSupabaseConfigured()
  ) {
    return { ok: false, response: feedbackRedirect("/feedback", setCookies, "fehler") };
  }
  const { supabase } = createRouteHandlerSupabase(request, setCookies);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: redirectWithSetCookies(loginNext(nextPath), setCookies) };
  }
  return { ok: true, formData: await request.formData(), setCookies, supabase };
}

export function loginNext(path: string): string {
  const url = new URL("/anmelden", `${getHubOrigin()}/`);
  url.searchParams.set("next", path);
  return url.toString();
}

export function draftFromForm(formData: FormData) {
  return parseFeedbackDraft({
    productKey: formValue(formData, "product_key"),
    category: formValue(formData, "category"),
    subject: formValue(formData, "subject"),
    body: formValue(formData, "body"),
    calculationId: formValue(formData, "calculation_id"),
  });
}

export function statusFromForm(formData: FormData) {
  return parseFeedbackStatus(formValue(formData, "status"));
}

export function messageFromForm(formData: FormData): string | null {
  const body = formValue(formData, "body");
  if (typeof body !== "string") return null;
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 4000) return null;
  return trimmed;
}

export function threadIdFromPath(id: string): string | null {
  return isPvNavigatorUuid(id) ? id.toLowerCase() : null;
}

export function hintForRpc(error: { message?: string } | null) {
  return feedbackErrorCode(error);
}
