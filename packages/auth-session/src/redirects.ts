export const AUTH_NEXT_SPEICHER_CALCULATE = "speicher-calculate";
export const AUTH_SIGN_IN_PATH = "/auth/sign-in";
export const AUTH_SIGN_OUT_PATH = "/auth/sign-out";
export const AUTH_CONTINUE_PATH = "/auth/continue";

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

export function getHubLoginUrlForSpeicherCalculate(): string {
  const url = new URL("/anmelden", getHubOrigin());
  url.searchParams.set("next", AUTH_NEXT_SPEICHER_CALCULATE);
  return url.toString();
}

export function getHubKontoUrl(): string {
  return `${getHubOrigin()}/konto`;
}

export function getHubSignupUrl(): string {
  return `${getHubOrigin()}/konto-erstellen`;
}

function hostFromHeader(raw: string | null | undefined): string | undefined {
  const host = raw?.split(",")[0]?.trim().split(":")[0]?.toLowerCase();
  return host || undefined;
}

export function isHubAuthMutationPath(pathname: string): boolean {
  return pathname === AUTH_SIGN_IN_PATH || pathname === AUTH_SIGN_OUT_PATH;
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
 * Same-origin hop after login so Domain=.pvnavigator.de is stored before a
 * cross-subdomain navigation to SpeicherGrenze.
 */
export function getHubAuthContinueUrl(nextRaw: unknown): string {
  const url = new URL(AUTH_CONTINUE_PATH, getHubOrigin());
  const next = parseAuthNextParam(nextRaw, "/");
  if (next && next !== "/") {
    url.searchParams.set("next", next);
  }
  return url.toString();
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
  return sanitizeNextPath(raw, fallback);
}

/**
 * Value stored on the login form. Aliases stay symbolic; paths are sanitized.
 */
export function parseAuthNextParam(raw: unknown, fallback = "/"): string {
  if (typeof raw === "string" && raw.trim() === AUTH_NEXT_SPEICHER_CALCULATE) {
    return AUTH_NEXT_SPEICHER_CALCULATE;
  }
  return sanitizeNextPath(raw, fallback);
}
