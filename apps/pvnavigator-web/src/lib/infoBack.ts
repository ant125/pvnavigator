export type InfoBackContext = {
  currentHref: string;
  referrer: string;
  historyLength: number;
  /** `performance` navigation entry URL from the document load, unchanged by in-app navigations. */
  navigationEntryUrl: string | null;
};

function pathOf(value: string, base?: string): { origin: string; path: string } | null {
  try {
    const url = new URL(value, base);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return { origin: url.origin, path };
  } catch {
    return null;
  }
}

/**
 * Back stays inside PVNAVIGATOR_ only when the previous history entry is this site.
 * A direct visit or an external referrer falls back to the homepage.
 */
export function shouldReturnToPreviousPage(input: InfoBackContext): boolean {
  if (input.historyLength <= 1) return false;

  const current = pathOf(input.currentHref);
  if (!current) return false;

  const referrer = input.referrer ? pathOf(input.referrer) : null;
  const referrerIsInternal = referrer?.origin === current.origin;
  const entry = input.navigationEntryUrl ? pathOf(input.navigationEntryUrl) : null;
  const landedOnThisPage = !entry || (entry.origin === current.origin && entry.path === current.path);

  if (!landedOnThisPage) return true;
  return referrerIsInternal;
}
