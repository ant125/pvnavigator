export type AuthCookieOptions = {
  path: "/";
  sameSite: "lax";
  secure: boolean;
  domain?: string;
};

const PRODUCTION_PARENT_DOMAIN = ".pvnavigator.de";

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
