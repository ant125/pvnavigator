export const SHARED_AUTH_COOKIE_NAME = "sb-pvnav-auth";

export type AuthCookieOptions = {
  name: string;
  path: "/";
  sameSite: "lax";
  secure: boolean;
  domain?: string;
  maxAge: number;
};

const PRODUCTION_PARENT_DOMAIN = ".pvnavigator.de";
const HOST_ONLY_EXPIRE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";
const PARENT_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
const AUTH_COOKIE_CHUNK_COUNT = 8;

const SHARED_AUTH_COOKIE =
  /^sb-pvnav-auth(?:-code-verifier)?(?:\.\d+)?$/;
const LEGACY_AUTH_COOKIE =
  /^sb-.+-auth-token(?:-code-verifier)?(?:\.\d+)?$/;

function firstHostFromHeader(raw: string | null | undefined): string | undefined {
  const host = raw?.split(",")[0]?.trim().split(":")[0]?.toLowerCase();
  return host || undefined;
}

function hostnameFromOrigin(raw: string | null | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    return firstHostFromHeader(new URL(value).hostname);
  } catch {
    return firstHostFromHeader(value);
  }
}

function hostnameQualifiesForParentDomain(hostname: string): boolean {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  return host === "pvnavigator.de" || host.endsWith(".pvnavigator.de");
}

/**
 * Prefer a public pvnavigator.de host over Vercel internal URLs.
 * Origin is the last fallback — Server Actions sometimes see *.vercel.app as Host.
 */
export function resolveRequestHostname(
  hostname?: string | null,
  hostHeader?: string | null,
  forwardedHost?: string | null,
  originHeader?: string | null,
): string | undefined {
  const candidates = [
    firstHostFromHeader(forwardedHost),
    firstHostFromHeader(hostHeader),
    firstHostFromHeader(hostname),
    hostnameFromOrigin(originHeader),
  ].filter((host): host is string => Boolean(host));

  return candidates.find(hostnameQualifiesForParentDomain) ?? candidates[0];
}

export function isSharedAuthCookieName(name: string): boolean {
  return SHARED_AUTH_COOKIE.test(name);
}

export function isLegacyAuthCookieName(name: string): boolean {
  return LEGACY_AUTH_COOKIE.test(name) && !isSharedAuthCookieName(name);
}

export function isSupabaseAuthCookieName(name: string): boolean {
  return isSharedAuthCookieName(name) || isLegacyAuthCookieName(name);
}

export function hasSupabaseAuthCookie(
  cookies: ReadonlyArray<{ name: string; value?: string }>,
): boolean {
  return cookies.some((cookie) => isSupabaseAuthCookieName(cookie.name) && Boolean(cookie.value));
}

export function supabaseProjectRefFromUrl(url: string | undefined): string | undefined {
  const raw = url?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).hostname.split(".")[0] || undefined;
  } catch {
    return undefined;
  }
}

function normalizeExplicitCookieDomain(raw: string): string | undefined {
  let value = raw.trim();
  if (!value) return undefined;
  try {
    if (value.includes("://")) {
      value = new URL(value).hostname;
    }
  } catch {
    return undefined;
  }
  const host = value.replace(/^\./, "").split(":")[0]?.toLowerCase();
  if (!host) return undefined;
  if (host === "pvnavigator.de" || host.endsWith(".pvnavigator.de")) {
    return PRODUCTION_PARENT_DOMAIN;
  }
  return undefined;
}

function readExplicitCookieDomain(): string | undefined {
  const fromPublic = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
  if (fromPublic) {
    const normalized = normalizeExplicitCookieDomain(fromPublic);
    if (normalized) return normalized;
  }
  const fromServer = process.env.AUTH_COOKIE_DOMAIN;
  if (fromServer) {
    const normalized = normalizeExplicitCookieDomain(fromServer);
    if (normalized) return normalized;
  }
  return undefined;
}

/**
 * Parent-domain cookie for pvnavigator.de + speicher.pvnavigator.de.
 * Localhost and preview hosts omit `domain` so cookies stay host-only.
 */
export function resolveAuthCookieDomain(hostname?: string): string | undefined {
  const explicit = readExplicitCookieDomain();
  if (explicit) return explicit;

  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : undefined);
  if (!host) return undefined;
  if (!hostnameQualifiesForParentDomain(host)) return undefined;
  return PRODUCTION_PARENT_DOMAIN;
}

export function getAuthCookieOptions(hostname?: string): AuthCookieOptions {
  const domain = resolveAuthCookieDomain(hostname);
  const options: AuthCookieOptions = {
    name: SHARED_AUTH_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: Boolean(domain) || process.env.NODE_ENV === "production",
    maxAge: PARENT_COOKIE_MAX_AGE,
  };
  if (domain) {
    options.domain = domain;
  }
  return options;
}

export function mergeAuthCookieOptions<T extends object>(
  options: T,
  hostname?: string,
): T & Omit<AuthCookieOptions, "name"> {
  const { name: _name, ...shared } = getAuthCookieOptions(hostname);
  return {
    ...options,
    ...shared,
  };
}

function hostOnlyExpireSetCookieHeader(name: string, secure: boolean): string {
  const securePart = secure ? "; Secure" : "";
  return `${name}=; Path=/; Max-Age=0; Expires=${HOST_ONLY_EXPIRE_DATE}; SameSite=Lax${securePart}`;
}

function cookieHeaderValue(value: string): string {
  if (/[;,\s"]/.test(value)) return encodeURIComponent(value);
  return value;
}

type AuthSetCookieExtra = {
  maxAge?: number;
};

export type AuthCookieWriter = {
  appendHeader: (name: string, value: string) => void;
};

/**
 * Raw Set-Cookie for the shared session. Session cookies always include
 * Domain when the host qualifies — never a same-name host-only copy.
 */
export function serializeAuthSetCookie(
  name: string,
  value: string,
  hostname?: string,
  extra?: AuthSetCookieExtra,
): string {
  const options = getAuthCookieOptions(hostname);
  const maxAge = extra?.maxAge ?? options.maxAge;
  const parts = [
    `${name}=${cookieHeaderValue(value)}`,
    `Path=${options.path}`,
    `Max-Age=${Math.trunc(maxAge)}`,
  ];
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (maxAge <= 0) {
    parts.push(`Expires=${HOST_ONLY_EXPIRE_DATE}`);
  }
  parts.push("SameSite=Lax");
  if (options.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function appendAuthCookiesFromSetAll(
  cookiesToSet: ReadonlyArray<{
    name: string;
    value: string;
    options?: AuthSetCookieExtra;
  }>,
  writer: AuthCookieWriter,
  hostname?: string,
): void {
  const domain = getAuthCookieOptions(hostname).domain;
  const secure = getAuthCookieOptions(hostname).secure;

  for (const cookie of cookiesToSet) {
    const maxAge = cookie.options?.maxAge;
    writer.appendHeader(
      "Set-Cookie",
      serializeAuthSetCookie(cookie.name, cookie.value, hostname, cookie.options),
    );
    if (typeof maxAge === "number" && maxAge <= 0 && domain) {
      writer.appendHeader(
        "Set-Cookie",
        hostOnlyExpireSetCookieHeader(cookie.name, secure),
      );
    }
  }
}

function sharedCookieNamesToExpire(): string[] {
  const names = [
    SHARED_AUTH_COOKIE_NAME,
    `${SHARED_AUTH_COOKIE_NAME}-code-verifier`,
  ];
  for (let i = 0; i < AUTH_COOKIE_CHUNK_COUNT; i += 1) {
    names.push(`${SHARED_AUTH_COOKIE_NAME}.${i}`);
    names.push(`${SHARED_AUTH_COOKIE_NAME}-code-verifier.${i}`);
  }
  return names;
}

function expireNamedAuthCookies(
  names: Iterable<string>,
  writer: AuthCookieWriter,
  hostname?: string,
): void {
  const options = getAuthCookieOptions(hostname);
  const unique = [...new Set(names)];
  for (const name of unique) {
    writer.appendHeader(
      "Set-Cookie",
      serializeAuthSetCookie(name, "", hostname, { maxAge: 0 }),
    );
    if (options.domain) {
      writer.appendHeader(
        "Set-Cookie",
        hostOnlyExpireSetCookieHeader(name, options.secure),
      );
    }
  }
}

export function expireLegacyAuthCookies(
  cookies: ReadonlyArray<{ name: string }>,
  writer: AuthCookieWriter,
  hostname?: string,
): void {
  const names = new Set<string>();
  for (const cookie of cookies) {
    if (isLegacyAuthCookieName(cookie.name)) names.add(cookie.name);
  }
  expireNamedAuthCookies(names, writer, hostname);
}

export function expireAuthCookiesForLogout(
  cookies: ReadonlyArray<{ name: string }>,
  writer: AuthCookieWriter,
  hostname?: string,
): void {
  const names = new Set(sharedCookieNamesToExpire());
  for (const cookie of cookies) {
    if (isSupabaseAuthCookieName(cookie.name)) names.add(cookie.name);
  }
  expireNamedAuthCookies(names, writer, hostname);
}

export function copySetCookieHeaders(from: Headers, to: Headers): void {
  const cookies =
    typeof from.getSetCookie === "function" ? from.getSetCookie() : [];
  for (const cookie of cookies) {
    to.append("Set-Cookie", cookie);
  }
}

export function authCookieWriter(headers: Headers): AuthCookieWriter {
  return {
    appendHeader: (name, value) => {
      headers.append(name, value);
    },
  };
}

export function redirectWithAuthCookies(
  location: string,
  setCookies: readonly string[],
): Response {
  const headers = new Headers();
  headers.set("Location", location);
  headers.set("Cache-Control", "no-store");
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 303, headers });
}
