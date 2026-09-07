export {
  authCookieWriter,
  copySetCookieHeaders,
  getAuthCookieOptions,
  hasSupabaseAuthCookie,
  hostOnlyExpireSetCookieHeader,
  isSupabaseAuthCookieName,
  mergeAuthCookieOptions,
  parentDomainSetCookieHeader,
  rehomeAuthCookiesToParentDomain,
  resolveAuthCookieDomain,
  resolveRequestHostname,
  supabaseProjectRefFromUrl,
  type AuthCookieOptions,
} from "./cookieOptions";

export {
  AUTH_NEXT_SPEICHER_CALCULATE,
  getHubKontoUrl,
  getHubLoginUrlForSpeicherCalculate,
  getHubOrigin,
  getHubSignupUrl,
  getSpeicherGrenzeCalculateUrl,
  getSpeicherGrenzeOrigin,
  parseAuthNextParam,
  resolvePostLoginRedirect,
  sanitizeNextPath,
} from "./redirects";
