export {
  getAuthCookieOptions,
  hostOnlyExpireSetCookieHeader,
  isSupabaseAuthCookieName,
  mergeAuthCookieOptions,
  rehomeAuthCookiesToParentDomain,
  resolveAuthCookieDomain,
  resolveRequestHostname,
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
