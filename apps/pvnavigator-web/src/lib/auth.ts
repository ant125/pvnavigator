import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

import {
  getHubAuthContinueUrl,
  getHubOrigin,
  parseAuthNextParam,
  resolvePostLoginRedirect,
} from "@pv-auth/session";

export {
  parseAuthNextParam,
  resolvePostLoginRedirect,
  sanitizeNextPath,
} from "@pv-auth/session";

const DEFAULT_AUTH_SITE_ORIGIN = "https://pvnavigator.de";

/**
 * Public site origin for auth redirects (`emailRedirectTo`, etc.).
 * Prefer `NEXT_PUBLIC_SITE_URL`; production-safe default is pvnavigator.de (not localhost).
 */
export function getAuthSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // ignore invalid URLs
    }
  }
  return DEFAULT_AUTH_SITE_ORIGIN;
}

export function getEmailConfirmationRedirectUrl(): string {
  return `${getAuthSiteOrigin()}/auth/callback`;
}

const SUPABASE_AUTH_FALLBACK =
  "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.";

/**
 * Maps Supabase Auth API errors to safe German copy. Does not log sensitive data.
 */
export function mapSupabaseAuthErrorToUserMessage(
  error: Pick<Error, "message"> & { code?: string; status?: number },
): string {
  const message = error.message.toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  const combined = `${code} ${message}`;

  if (message.includes("signup is disabled") || code === "signup_disabled") {
    return "Neue Registrierungen sind derzeit deaktiviert.";
  }

  if (
    message.includes("email rate limit exceeded") ||
    combined.includes("over_email_send_rate") ||
    code === "email_rate_limit_exceeded"
  ) {
    return "Zu viele Bestätigungs-E-Mails. Bitte versuchen Sie es in ein paar Minuten erneut.";
  }

  if (
    message.includes("user already registered") ||
    message.includes("already registered") ||
    combined.includes("user_already_registered") ||
    combined.includes("email_exists") ||
    code === "user_already_registered"
  ) {
    return "Für diese E-Mail-Adresse existiert bereits ein Konto. Bitte melden Sie sich an.";
  }

  if (message.includes("password should be at least") || code === "weak_password") {
    return "Das Passwort ist zu kurz.";
  }

  if (message.includes("invalid login credentials") || code === "invalid_credentials") {
    return "Die E-Mail-Adresse oder das Passwort ist falsch.";
  }

  if (message.includes("email not confirmed") || code === "email_not_confirmed") {
    return "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.";
  }

  return SUPABASE_AUTH_FALLBACK;
}

const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
  missing: "Bitte E-Mail und Passwort eingeben.",
  invalid: "Die E-Mail-Adresse oder das Passwort ist falsch.",
  unconfirmed: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.",
  config: "Anmeldung ist nicht konfiguriert.",
  generic: SUPABASE_AUTH_FALLBACK,
};

export function signInErrorFromQuery(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  return SIGN_IN_ERROR_MESSAGES[raw];
}

export function mapSupabaseAuthErrorToSignInCode(
  error: Pick<Error, "message"> & { code?: string },
): string {
  const message = error.message.toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  if (message.includes("invalid login credentials") || code === "invalid_credentials") {
    return "invalid";
  }
  if (message.includes("email not confirmed") || code === "email_not_confirmed") {
    return "unconfirmed";
  }
  return "generic";
}

export function hubSignInErrorUrl(code: string, nextRaw: unknown): string {
  const url = new URL("/anmelden", getHubOrigin());
  url.searchParams.set("error", SIGN_IN_ERROR_MESSAGES[code] ? code : "generic");
  const next = parseAuthNextParam(nextRaw, "/");
  if (next && next !== "/") {
    url.searchParams.set("next", next);
  }
  return url.toString();
}

export function hubPostLoginLocation(nextRaw: unknown): string {
  const dest = resolvePostLoginRedirect(nextRaw, "/");
  if (dest.startsWith("http")) {
    return getHubAuthContinueUrl(nextRaw);
  }
  return new URL(dest, `${getHubOrigin()}/`).toString();
}

export async function getServerUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
