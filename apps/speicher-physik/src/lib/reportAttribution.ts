/**
 * Company and client lines printed on a SPEICHERGRENZE PDF.
 * They are stored with the calculation and are not inputs to the physics model.
 */

const CONTROL = /[\u0000-\u001F\u007F]/;

export type FrozenReportAttribution = {
  companyName: string;
  clientGivenName: string;
  clientFamilyName: string;
};

export type ReportClientNames = {
  givenName: string;
  familyName: string;
};

function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function personName(value: string): boolean {
  return value.length >= 1 && value.length <= 80 && !CONTROL.test(value);
}

function companyName(value: string): boolean {
  return value.length >= 1 && value.length <= 160 && !CONTROL.test(value);
}

export function parseReportClient(value: unknown): ReportClientNames | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const givenName = clean(record.givenName);
  const familyName = clean(record.familyName);
  if (!personName(givenName) || !personName(familyName)) return null;
  return { givenName, familyName };
}

/**
 * A company report keeps the profile's Firmenname and the client names from
 * this calculation. Any other account kind stores nothing.
 */
export function freezeReportAttribution(args: {
  accountKind: unknown;
  companyName: unknown;
  client: ReportClientNames | null;
}): FrozenReportAttribution | null {
  if (args.accountKind !== "unternehmen") return null;
  const company = clean(args.companyName);
  if (!companyName(company) || !args.client) return null;
  return {
    companyName: company,
    clientGivenName: args.client.givenName,
    clientFamilyName: args.client.familyName,
  };
}

export function reportAttributionFromStoredInput(
  input: unknown,
): FrozenReportAttribution | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = (input as Record<string, unknown>).reportAttribution;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  return freezeReportAttribution({
    accountKind: "unternehmen",
    companyName: record.companyName,
    client: parseReportClient({
      givenName: record.clientGivenName,
      familyName: record.clientFamilyName,
    }),
  });
}

export function reportClientLabel(attribution: FrozenReportAttribution): string {
  return `${attribution.clientGivenName} ${attribution.clientFamilyName}`;
}
