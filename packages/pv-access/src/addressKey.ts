/**
 * Stable key for "one address" in the access rules.
 *
 * The key is derived from the entered fields only (not from the geocoder),
 * so the same input always yields the same key and a later change in the
 * geocoder's formatting cannot silently turn a pinned address into a new
 * object. Differences in case, whitespace, umlaut spelling and the common
 * "Str." abbreviation collapse; different house numbers (including letter
 * suffixes such as 12 / 12a / 12b) stay distinct.
 */

export type AddressKeyInput = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
};

export const ADDRESS_KEY_VERSION = "v1";

const UMLAUTS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
};

function foldGerman(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => UMLAUTS[char] ?? char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Street: folded, "str." / "str" / "strasse" at a word end → "strasse",
 * punctuation except hyphen removed, whitespace collapsed.
 */
export function normalizeStreetForKey(street: string): string {
  let value = foldGerman(street);
  value = value.replace(/[.,;:'"`´’]/g, " ");
  value = collapseWhitespace(value);
  // "musterstr" / "muster str" / "musterstrasse" → "musterstrasse"
  value = value.replace(/\bstr\b/g, "strasse");
  value = value.replace(/([a-z])str\b/g, "$1strasse");
  // "muster strasse" and "musterstrasse" are the same street.
  value = value.replace(/ strasse\b/g, "strasse");
  value = value.replace(/\s*-\s*/g, "-");
  return collapseWhitespace(value);
}

/** House number: folded, inner whitespace removed, "12 a" → "12a", "12 - 14" → "12-14". */
export function normalizeHouseNumberForKey(houseNumber: string): string {
  return foldGerman(houseNumber)
    .replace(/\s*[-–—/]\s*/g, "-")
    .replace(/\s+/g, "");
}

/** Postal code: digits only. */
export function normalizePostalCodeForKey(postalCode: string): string {
  return postalCode.replace(/\D/g, "");
}

/** City: folded, punctuation removed, whitespace collapsed. */
export function normalizeCityForKey(city: string): string {
  return collapseWhitespace(
    foldGerman(city)
      .replace(/[.,;:'"`´’()]/g, " ")
      .replace(/\s*-\s*/g, "-"),
  );
}

/**
 * Deterministic address key. Empty when a mandatory component is missing,
 * so callers can refuse instead of pinning or counting a half address.
 */
export function buildAddressKey(input: AddressKeyInput): string {
  const postalCode = normalizePostalCodeForKey(input.postalCode);
  const street = normalizeStreetForKey(input.street);
  const houseNumber = normalizeHouseNumberForKey(input.houseNumber);
  const city = normalizeCityForKey(input.city);
  if (!postalCode || !street || !houseNumber || !city) return "";
  return `${ADDRESS_KEY_VERSION}|de|${postalCode}|${city}|${street}|${houseNumber}`;
}

/** Human-readable label for the entered address (not the key). */
export function formatAddressLabel(input: AddressKeyInput): string {
  const street = collapseWhitespace(input.street);
  const houseNumber = collapseWhitespace(input.houseNumber);
  const postalCode = collapseWhitespace(input.postalCode);
  const city = collapseWhitespace(input.city);
  const line1 = [street, houseNumber].filter(Boolean).join(" ");
  const line2 = [postalCode, city].filter(Boolean).join(" ");
  return [line1, line2].filter(Boolean).join(", ");
}
