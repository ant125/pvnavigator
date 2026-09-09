export const AUTH_NEXT_SPEICHER_CALCULATE = "speicher-calculate";
export const AUTH_RETURN_SPEICHER = "speicher";
export const AUTH_NEXT_SPEICHER_RESULT_PREFIX = "speicher-result:";
export const AUTH_SIGN_IN_PATH = "/auth/sign-in";
export const AUTH_SIGN_UP_PATH = "/auth/sign-up";
export const AUTH_SIGN_OUT_PATH = "/auth/sign-out";
export const AUTH_CALLBACK_PATH = "/auth/callback";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPvNavigatorUuid(raw: unknown): raw is string {
  return typeof raw === "string" && UUID_RE.test(raw.trim());
}

const DEFAULT_HUB_ORIGIN = "https://pvnavigator.de";
const DEFAULT_SPEICHER_ORIGIN = "https://speicher.pvnavigator.de";
const LOCAL_HUB_ORIGIN = "http://localhost:3000";
const LOCAL_SPEICHER_ORIGIN = "http://localhost:3001";

function originFromEnv(raw: string | undefined, fallback: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  try {
    return new URL(trimmed).origin;
  } catch {
    return fallback;
  }
}

function isSpeicherGrenzeHost(hostname: string): boolean {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  return host === "speicher.pvnavigator.de" || host.endsWith(".speicher.pvnavigator.de");
}

export function getHubOrigin(): string {
  const fallback =
    process.env.NODE_ENV === "production" ? DEFAULT_HUB_ORIGIN : LOCAL_HUB_ORIGIN;
  const fromHub = originFromEnv(process.env.NEXT_PUBLIC_HUB_URL, "");
  if (fromHub) return fromHub;

  const fromSite = originFromEnv(process.env.NEXT_PUBLIC_SITE_URL, fallback);
  try {
    if (isSpeicherGrenzeHost(new URL(fromSite).hostname)) {
      return fallback;
    }
  } catch {
    return fallback;
  }
  return fromSite;
}

export function getSpeicherGrenzeOrigin(): string {
  const fallback =
    process.env.NODE_ENV === "production"
      ? DEFAULT_SPEICHER_ORIGIN
      : LOCAL_SPEICHER_ORIGIN;
  return originFromEnv(process.env.NEXT_PUBLIC_SPEICHER_GRENZE_URL, fallback);
}

export function getSpeicherGrenzeCalculateUrl(): string {
  return `${getSpeicherGrenzeOrigin()}/calculate`;
}

export function getSpeicherGrenzeResultUrl(id: string): string | null {
  const uuid = id.trim();
  if (!isPvNavigatorUuid(uuid)) return null;
  return `${getSpeicherGrenzeOrigin()}/result/${uuid.toLowerCase()}`;
}

export function getHubLoginUrlForSpeicherCalculate(): string {
  const url = new URL("/anmelden", getHubOrigin());
  url.searchParams.set("next", AUTH_NEXT_SPEICHER_CALCULATE);
  return url.toString();
}

export function getHubLoginUrlForSpeicherResult(id: string): string {
  const uuid = id.trim();
  if (!isPvNavigatorUuid(uuid)) {
    return getHubLoginUrlForSpeicherCalculate();
  }
  const url = new URL("/anmelden", getHubOrigin());
  url.searchParams.set(
    "next",
    `${AUTH_NEXT_SPEICHER_RESULT_PREFIX}${uuid.toLowerCase()}`,
  );
  return url.toString();
}

function parseSpeicherResultNext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith(AUTH_NEXT_SPEICHER_RESULT_PREFIX)) return null;
  const id = trimmed.slice(AUTH_NEXT_SPEICHER_RESULT_PREFIX.length);
  if (!isPvNavigatorUuid(id)) return null;
  return `${AUTH_NEXT_SPEICHER_RESULT_PREFIX}${id.trim().toLowerCase()}`;
}

export function getHubKontoUrl(): string {
  return `${getHubOrigin()}/konto`;
}

export function getHubSignupUrl(): string {
  return `${getHubOrigin()}/konto-erstellen`;
}

export function getHubSignOutUrl(options?: { returnTo?: string }): string {
  const url = new URL(AUTH_SIGN_OUT_PATH, `${getHubOrigin()}/`);
  if (options?.returnTo === AUTH_RETURN_SPEICHER) {
    url.searchParams.set("returnTo", AUTH_RETURN_SPEICHER);
  }
  return url.toString();
}

function hostFromHeader(raw: string | null | undefined): string | undefined {
  const host = raw?.split(",")[0]?.trim().split(":")[0]?.toLowerCase();
  return host || undefined;
}

export function isHubAuthMutationPath(pathname: string): boolean {
  return (
    pathname === AUTH_SIGN_IN_PATH ||
    pathname === AUTH_SIGN_UP_PATH ||
    pathname === AUTH_SIGN_OUT_PATH ||
    pathname === AUTH_CALLBACK_PATH
  );
}

function hostnameFromOriginHeader(originHeader: string): string | undefined {
  try {
    return new URL(originHeader).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isPvNavigatorFamilyHost(hostname: string): boolean {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  return host === "pvnavigator.de" || host.endsWith(".pvnavigator.de");
}

/**
 * CSRF check for document POSTs: Origin host must match the public Host
 * (X-Forwarded-Host on Vercel, otherwise Host).
 */
export function isAllowedHubFormOrigin(
  originHeader: string | null,
  hostHeader?: string | null,
  forwardedHost?: string | null,
  requestOrigin?: string,
): boolean {
  if (!originHeader) return false;
  try {
    const originHost = new URL(originHeader).hostname.toLowerCase();
    const requestHost =
      hostFromHeader(forwardedHost) ??
      hostFromHeader(hostHeader) ??
      (requestOrigin ? new URL(requestOrigin).hostname.toLowerCase() : undefined);
    return Boolean(requestHost) && originHost === requestHost;
  } catch {
    return false;
  }
}

/**
 * Sign-out may be posted from Hub or from a product on a sibling
 * `*.pvnavigator.de` host. Same-host Hub forms (including preview) stay allowed.
 * Arbitrary external origins are rejected.
 */
export function isAllowedHubSignOutOrigin(
  originHeader: string | null,
  hostHeader?: string | null,
  forwardedHost?: string | null,
  requestOrigin?: string,
): boolean {
  if (
    isAllowedHubFormOrigin(originHeader, hostHeader, forwardedHost, requestOrigin)
  ) {
    return true;
  }
  if (!originHeader) return false;
  const originHost = hostnameFromOriginHeader(originHeader);
  if (!originHost) return false;
  return isPvNavigatorFamilyHost(originHost);
}

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

/**
 * Resolves the post-login destination.
 * Approved aliases map to a fixed URL. Anything else must be a same-origin path.
 */
export function resolvePostLoginRedirect(raw: unknown, fallback = "/"): string {
  if (typeof raw === "string" && raw.trim() === AUTH_NEXT_SPEICHER_CALCULATE) {
    return getSpeicherGrenzeCalculateUrl();
  }
  const resultNext = parseSpeicherResultNext(raw);
  if (resultNext) {
    const id = resultNext.slice(AUTH_NEXT_SPEICHER_RESULT_PREFIX.length);
    return getSpeicherGrenzeResultUrl(id) ?? getSpeicherGrenzeCalculateUrl();
  }
  return sanitizeNextPath(raw, fallback);
}

/**
 * Resolves the post-logout destination.
 * Approved aliases map to a fixed product origin. Anything else is Hub /.
 */
export function resolvePostLogoutLocation(raw: unknown): string {
  if (typeof raw === "string" && raw.trim() === AUTH_RETURN_SPEICHER) {
    return `${getSpeicherGrenzeOrigin()}/`;
  }
  return new URL("/", `${getHubOrigin()}/`).toString();
}

export function resolvePostLoginLocation(nextRaw: unknown, fallback = "/konto"): string {
  const dest = resolvePostLoginRedirect(nextRaw, fallback);
  if (dest.startsWith("http")) return dest;
  return new URL(dest, `${getHubOrigin()}/`).toString();
}

/**
 * Value stored on the login form. Aliases stay symbolic; paths are sanitized.
 */
export function parseAuthNextParam(raw: unknown, fallback = "/"): string {
  if (typeof raw === "string" && raw.trim() === AUTH_NEXT_SPEICHER_CALCULATE) {
    return AUTH_NEXT_SPEICHER_CALCULATE;
  }
  const resultNext = parseSpeicherResultNext(raw);
  if (resultNext) return resultNext;
  return sanitizeNextPath(raw, fallback);
}
