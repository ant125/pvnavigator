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

function cookieHeaderValue(value: string): string {
  if (/[;,\s"]/.test(value)) return encodeURIComponent(value);
  return value;
}

export function parentDomainSetCookieHeader(
  name: string,
  value: string,
  options: AuthCookieOptions & { maxAge: number },
): string {
  const domainPart = options.domain ? `; Domain=${options.domain}` : "";
  const securePart = options.secure ? "; Secure" : "";
  return `${name}=${cookieHeaderValue(value)}; Path=${options.path}; Max-Age=${options.maxAge}; SameSite=Lax${domainPart}${securePart}`;
}

type AuthSetCookieExtra = {
  maxAge?: number;
  httpOnly?: boolean;
};

export type AuthCookieWriter = {
  appendHeader: (name: string, value: string) => void;
};

/**
 * Raw Set-Cookie line. Values are not URI-encoded so they match what
 * `@supabase/ssr` stores. Prefer this over `cookies().set()` — Next.js
 * Server Actions drop `Domain` and strip `Set-Cookie` on `redirect()`.
 */
export function serializeAuthSetCookie(
  name: string,
  value: string,
  hostname?: string,
  extra?: AuthSetCookieExtra,
): string {
  const options = getAuthCookieOptions(hostname);
  const maxAge = extra?.maxAge ?? PARENT_COOKIE_MAX_AGE;
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
  if (extra?.httpOnly) {
    parts.push("HttpOnly");
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
  for (const cookie of cookiesToSet) {
    writer.appendHeader(
      "Set-Cookie",
      serializeAuthSetCookie(cookie.name, cookie.value, hostname, cookie.options),
    );
  }
}

export function expireHostOnlyAuthCookies(
  cookies: ReadonlyArray<{ name: string }>,
  writer: AuthCookieWriter,
  hostname?: string,
): void {
  const secure = getAuthCookieOptions(hostname).secure;
  const names = new Set<string>();
  for (const cookie of cookies) {
    if (isSupabaseAuthCookieName(cookie.name)) names.add(cookie.name);
  }
  for (const name of names) {
    writer.appendHeader("Set-Cookie", hostOnlyExpireSetCookieHeader(name, secure));
  }
}

export function copySetCookieHeaders(from: Headers, to: Headers): void {
  const cookies =
    typeof from.getSetCookie === "function" ? from.getSetCookie() : [];
  for (const cookie of cookies) {
    to.append("Set-Cookie", cookie);
  }
}

/**
 * Re-emit matching auth cookies on `.pvnavigator.de`.
 *
 * Host-only `Max-Age=0` is not sent here: Chrome can treat a nameless expire
 * without Domain as deleting the parent-domain cookie on the same response.
 * Login/logout Route Handlers write Domain cookies explicitly instead.
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

/**
 * Parses `document.cookie`. Values may contain `=`; split on the first one.
 */
export function authCookiesFromDocumentCookie(
  raw: string,
): Array<{ name: string; value: string }> {
  const cookies: Array<{ name: string; value: string }> = [];
  if (!raw) return cookies;
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!isSupabaseAuthCookieName(name) || !value) continue;
    cookies.push({ name, value });
  }
  return cookies;
}

/**
 * Copy readable `sb-*-auth-token` cookies onto `.pvnavigator.de`.
 *
 * Chrome keeps a host-only cookie (no Domain) from Next.js and ignores a
 * same-name `Domain=.pvnavigator.de` Set-Cookie until the host-only copy is
 * expired first. No-op on localhost and when cookies are HttpOnly.
 */
export async function rehomeReadableAuthCookiesInBrowser(): Promise<number> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return 0;
  }
  const hostname = window.location.hostname;
  if (!resolveAuthCookieDomain(hostname)) return 0;

  const snapshot = authCookiesFromDocumentCookie(document.cookie);
  if (snapshot.length === 0) return 0;

  if (await rehomeAuthCookiesWithCookieStore(snapshot, hostname)) {
    return snapshot.length;
  }

  const secure = getAuthCookieOptions(hostname).secure;
  for (const cookie of snapshot) {
    document.cookie = hostOnlyExpireSetCookieHeader(cookie.name, secure);
  }
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
  for (const cookie of snapshot) {
    document.cookie = serializeAuthSetCookie(cookie.name, cookie.value, hostname);
  }
  return snapshot.length;
}

type BrowserCookieStore = {
  delete: (options: { name: string; path?: string }) => Promise<void>;
  set: (options: {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    sameSite?: "lax" | "strict" | "none";
    expires?: number;
  }) => Promise<void>;
};

async function rehomeAuthCookiesWithCookieStore(
  snapshot: ReadonlyArray<{ name: string; value: string }>,
  hostname: string,
): Promise<boolean> {
  const store = (window as Window & { cookieStore?: BrowserCookieStore }).cookieStore;
  if (!store?.delete || !store.set) return false;

  const domain = resolveAuthCookieDomain(hostname)?.replace(/^\./, "");
  if (!domain) return false;

  const expires = Date.now() + PARENT_COOKIE_MAX_AGE * 1000;
  try {
    for (const cookie of snapshot) {
      await store.delete({ name: cookie.name, path: "/" });
      await store.set({
        name: cookie.name,
        value: cookie.value,
        domain,
        path: "/",
        sameSite: "lax",
        expires,
      });
    }
    return true;
  } catch {
    return false;
  }
}
