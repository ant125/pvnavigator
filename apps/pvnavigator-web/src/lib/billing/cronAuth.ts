import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when that variable is set.
 * Missing or wrong credentials are rejected. The comparison does not throw.
 */
export function cronRequestAuthorized(authorization: string | null, secret: string | undefined): boolean {
  const configured = secret?.trim() ?? "";
  if (!configured || !authorization) return false;
  const expected = Buffer.from(`Bearer ${configured}`);
  const received = Buffer.from(authorization);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
