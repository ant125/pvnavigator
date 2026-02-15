/**
 * Central config for tool URLs.
 * Environment-based: development uses localhost, production uses subdomains.
 * Pure routing layer – no business logic.
 */

const isProduction = process.env.NODE_ENV === "production";

export const toolUrls = {
  speicherPhysik: isProduction
    ? "https://speicher-physik.pvnavigator.de"
    : "http://localhost:3001",
  speicherWirtschaft: isProduction
    ? "https://speicher-wirtschaft.pvnavigator.de"
    : "http://localhost:3002",
  pvshadow: isProduction
    ? "https://pvshadow.pvnavigator.de"
    : "http://localhost:3003",
} as const;
