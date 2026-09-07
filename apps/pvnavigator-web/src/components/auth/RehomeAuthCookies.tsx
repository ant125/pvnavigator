"use client";

import { useEffect } from "react";
import { rehomeReadableAuthCookiesInBrowser } from "@pv-auth/session";

/**
 * Copies the hub host-only Supabase session onto `.pvnavigator.de`
 * so speicher.pvnavigator.de can read it.
 */
export function RehomeAuthCookies() {
  useEffect(() => {
    void rehomeReadableAuthCookiesInBrowser();
  }, []);
  return null;
}
