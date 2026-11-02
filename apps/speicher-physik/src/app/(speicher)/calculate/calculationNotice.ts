/**
 * Server-side refusals that are not input mistakes. The form shows them in
 * their own box instead of under "Bitte korrigieren Sie folgende Fehler".
 *
 * - "unavailable": the access check or the record step could not run
 *   (database/RPC not reachable). The calculation is never shown in that
 *   case; the user is asked to retry later.
 * - "access": the access rules refused the entered address (free address
 *   already pinned, subscription limit reached, ...).
 */
export type CalculationNoticeKind = "unavailable" | "access";

/** Pinned free address as stored for this account. Empty parts cannot be restored. */
export type PinnedAddressFields = {
  label: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
};

export function parsePinnedAddress(value: unknown): PinnedAddressFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const text = (key: string) => (typeof record[key] === "string" ? record[key].trim() : "");
  const label = text("label");
  if (!label) return null;
  return {
    label,
    street: text("street"),
    houseNumber: text("houseNumber"),
    postalCode: text("postalCode"),
    city: text("city"),
  };
}

export function pinnedAddressIsRestorable(address: PinnedAddressFields | null | undefined): boolean {
  return Boolean(
    address?.street && address.houseNumber && address.postalCode && address.city,
  );
}

export type CalculationNotice = {
  kind: CalculationNoticeKind;
  message: string;
  code?: string | null;
  freeAddress?: PinnedAddressFields | null;
  /** Paid quota that blocked the address, when the server sent one. */
  addressLimit?: number | null;
};

export function parseAddressLimit(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** `code` the API uses for a temporarily unavailable access check. */
export const SERVICE_UNAVAILABLE_CODE = "service_unavailable";

export class CalculationNoticeError extends Error {
  readonly kind: CalculationNoticeKind;
  readonly code: string | null;
  readonly freeAddress: PinnedAddressFields | null;
  readonly addressLimit: number | null;

  constructor(
    kind: CalculationNoticeKind,
    message: string,
    code: string | null = null,
    freeAddress: PinnedAddressFields | null = null,
    addressLimit: number | null = null,
  ) {
    super(message);
    this.name = "CalculationNoticeError";
    this.kind = kind;
    this.code = code;
    this.freeAddress = freeAddress;
    this.addressLimit = addressLimit;
  }
}

export function noticeKindFromCode(
  code: string | null | undefined
): CalculationNoticeKind | null {
  if (!code) return null;
  return code === SERVICE_UNAVAILABLE_CODE ? "unavailable" : "access";
}

export const NOTICE_HEADINGS: Record<CalculationNoticeKind, string> = {
  unavailable: "Dienst vorübergehend nicht verfügbar",
  access: "Hinweis zum Zugang",
};

export const UNAVAILABLE_NOTICE_DETAIL =
  "Ihre Eingaben sind davon nicht betroffen und bleiben erhalten.";
