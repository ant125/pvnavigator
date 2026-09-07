import { isSupabaseAuthCookieName } from "./cookieOptions";

const HANDOFF_TTL_MS = 60_000;
const MAX_HANDOFF_COOKIES = 8;
const MAX_COOKIE_VALUE_LENGTH = 16_384;

export type AuthHandoffCookie = { name: string; value: string };

export type AuthHandoff =
  | { type: "cookies"; cookies: AuthHandoffCookie[] }
  | { type: "tokens"; accessToken: string; refreshToken: string };

function toBase64Url(text: string): string {
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(text, "utf8").toString("base64")
      : btoa(text);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(raw: string): string {
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
  const base64 = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return typeof Buffer !== "undefined"
    ? Buffer.from(base64, "base64").toString("utf8")
    : atob(base64);
}

function sanitizeHandoffCookies(
  cookies: ReadonlyArray<{ name: string; value: string }>,
): AuthHandoffCookie[] {
  const safe: AuthHandoffCookie[] = [];
  for (const cookie of cookies) {
    if (!isSupabaseAuthCookieName(cookie.name) || !cookie.value) continue;
    if (cookie.value.length > MAX_COOKIE_VALUE_LENGTH) continue;
    safe.push({ name: cookie.name, value: cookie.value });
    if (safe.length >= MAX_HANDOFF_COOKIES) break;
  }
  return safe;
}

export function encodeAuthCookieHandoff(
  cookies: ReadonlyArray<{ name: string; value: string }>,
): string {
  return toBase64Url(
    JSON.stringify({
      c: sanitizeHandoffCookies(cookies).map((cookie) => [cookie.name, cookie.value]),
      exp: Date.now() + HANDOFF_TTL_MS,
    }),
  );
}

export function decodeAuthHandoff(raw: string): AuthHandoff | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(fromBase64Url(raw)) as {
      c?: unknown;
      at?: unknown;
      rt?: unknown;
      exp?: unknown;
    };
    if (typeof data.exp === "number" && data.exp < Date.now()) return null;

    if (Array.isArray(data.c)) {
      const cookies = sanitizeHandoffCookies(
        data.c.flatMap((entry) => {
          if (!Array.isArray(entry) || entry.length < 2) return [];
          if (typeof entry[0] !== "string" || typeof entry[1] !== "string") return [];
          return [{ name: entry[0], value: entry[1] }];
        }),
      );
      return cookies.length > 0 ? { type: "cookies", cookies } : null;
    }

    if (typeof data.at === "string" && typeof data.rt === "string" && data.at && data.rt) {
      return { type: "tokens", accessToken: data.at, refreshToken: data.rt };
    }
    return null;
  } catch {
    return null;
  }
}
