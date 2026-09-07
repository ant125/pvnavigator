export type AuthCookieOptions = {
  path: "/";
  sameSite: "lax";
  secure: boolean;
  domain?: string;
};

const PRODUCTION_PARENT_DOMAIN = ".pvnavigator.de";
const AUTH_TOKEN_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;
const HOST_ONLY_EXPIRE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";
const PARENT_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

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

export function isSupabaseAuthCookieName(name: string): boolean {
  return AUTH_TOKEN_COOKIE.test(name);
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
    path: "/",
    sameSite: "lax",
    secure: Boolean(domain) || process.env.NODE_ENV === "production",
  };
  if (domain) {
    options.domain = domain;
  }
  return options;
}

export function mergeAuthCookieOptions<T extends object>(
  options: T,
  hostname?: string,
): T & AuthCookieOptions {
  return {
    ...options,
    ...getAuthCookieOptions(hostname),
  };
}

/**
 * Host-only Set-Cookie that expires a legacy `pvnavigator.de` auth cookie.
 * Next.js keys cookies by name only, so this must be appended as a raw header
 * rather than `cookies.set()`, or it would overwrite the parent-domain cookie.
 */
export function hostOnlyExpireSetCookieHeader(name: string, secure: boolean): string {
  const securePart = secure ? "; Secure" : "";
  return `${name}=; Path=/; Max-Age=0; Expires=${HOST_ONLY_EXPIRE_DATE}; SameSite=Lax${securePart}`;
}

export function parentDomainSetCookieHeader(
  name: string,
  value: string,
  options: AuthCookieOptions & { maxAge: number },
): string {
  const domainPart = options.domain ? `; Domain=${options.domain}` : "";
  const securePart = options.secure ? "; Secure" : "";
  return `${name}=${value}; Path=${options.path}; Max-Age=${options.maxAge}; SameSite=${options.sameSite}${domainPart}${securePart}`;
}

export function copySetCookieHeaders(from: Headers, to: Headers): void {
  const cookies =
    typeof from.getSetCookie === "function" ? from.getSetCookie() : [];
  for (const cookie of cookies) {
    to.append("Set-Cookie", cookie);
  }
}

type AuthCookieWriter = {
  appendHeader: (name: string, value: string) => void;
};

/**
 * Re-emit matching auth cookies on `.pvnavigator.de` and expire the host-only
 * copies. Both headers are appended as raw Set-Cookie so Next.js cannot
 * collapse them by cookie name.
 */
export function rehomeAuthCookiesToParentDomain(
  cookies: ReadonlyArray<{ name: string; value: string }>,
  writer: AuthCookieWriter,
  hostname?: string,
): void {
  const parent = getAuthCookieOptions(hostname);
  if (!parent.domain) return;

  for (const cookie of cookies) {
    if (!isSupabaseAuthCookieName(cookie.name) || !cookie.value) continue;
    writer.appendHeader(
      "Set-Cookie",
      hostOnlyExpireSetCookieHeader(cookie.name, parent.secure),
    );
    writer.appendHeader(
      "Set-Cookie",
      parentDomainSetCookieHeader(cookie.name, cookie.value, {
        ...parent,
        maxAge: PARENT_COOKIE_MAX_AGE,
      }),
    );
  }
}

export function authCookieWriter(headers: Headers): AuthCookieWriter {
  return {
    appendHeader: (name, value) => {
      headers.append(name, value);
    },
  };
}
