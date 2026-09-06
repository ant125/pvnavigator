export type AuthCookieOptions = {
  path: "/";
  sameSite: "lax";
  secure: boolean;
  domain?: string;
};

const PRODUCTION_PARENT_DOMAIN = ".pvnavigator.de";
const AUTH_TOKEN_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;
const HOST_ONLY_EXPIRE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";

function firstHostFromHeader(raw: string | null | undefined): string | undefined {
  const host = raw?.split(",")[0]?.trim().split(":")[0]?.toLowerCase();
  return host || undefined;
}

/**
 * Prefer the public Host / X-Forwarded-Host over nextUrl.hostname.
 * Vercel internal URLs (*.vercel.app) must not decide the cookie Domain.
 */
export function resolveRequestHostname(
  hostname?: string | null,
  hostHeader?: string | null,
  forwardedHost?: string | null,
): string | undefined {
  return (
    firstHostFromHeader(forwardedHost) ||
    firstHostFromHeader(hostHeader) ||
    firstHostFromHeader(hostname)
  );
}

export function isSupabaseAuthCookieName(name: string): boolean {
  return AUTH_TOKEN_COOKIE.test(name);
}

function readExplicitCookieDomain(): string | undefined {
  const fromPublic = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim();
  if (fromPublic) return fromPublic;
  const fromServer = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (fromServer) return fromServer;
  return undefined;
}

function hostnameQualifiesForParentDomain(hostname: string): boolean {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  return host === "pvnavigator.de" || host.endsWith(".pvnavigator.de");
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

type AuthCookieWriter = {
  appendHeader: (name: string, value: string) => void;
  setCookie: (
    name: string,
    value: string,
    options: AuthCookieOptions & { maxAge: number },
  ) => void;
};

/**
 * Re-emit matching auth cookies on `.pvnavigator.de` and expire the host-only
 * copies. Existing hub sessions were written without Domain and are invisible
 * to speicher.pvnavigator.de until this runs.
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
    writer.setCookie(cookie.name, cookie.value, {
      ...parent,
      maxAge: 400 * 24 * 60 * 60,
    });
  }
}
