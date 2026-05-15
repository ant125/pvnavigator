import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Same-origin relative paths only; blocks protocol-relative and absolute URLs.
 */
export function sanitizeNextPath(raw: unknown, fallback = "/konto"): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (trimmed.toLowerCase().startsWith("/\\")) return fallback;
  return trimmed || fallback;
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

export async function getServerUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
