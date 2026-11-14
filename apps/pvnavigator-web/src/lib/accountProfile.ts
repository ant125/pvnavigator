export type AccountKindChoice = "privat" | "unternehmen";

export type SavedAccountProfile = {
  accountKind: AccountKindChoice;
  givenName: string;
  familyName: string;
  companyName: string | null;
};

export type AccountProfileView = {
  accountKind: AccountKindChoice | null;
  givenName: string;
  familyName: string;
  companyName: string;
};

const CONTROL = /[\u0000-\u001F\u007F]/;

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

export function parseAccountProfileFields(fields: {
  accountKind: unknown;
  givenName: unknown;
  familyName: unknown;
  companyName: unknown;
}): SavedAccountProfile | null {
  const accountKind = fields.accountKind === "privat" || fields.accountKind === "unternehmen"
    ? fields.accountKind
    : null;
  if (!accountKind) return null;
  const givenName = clean(fields.givenName);
  const familyName = clean(fields.familyName);
  if (!personName(givenName) || !personName(familyName)) return null;
  if (accountKind === "privat") {
    return { accountKind, givenName, familyName, companyName: null };
  }
  const company = clean(fields.companyName);
  if (!companyName(company)) return null;
  return { accountKind, givenName, familyName, companyName: company };
}

export function emptyAccountProfile(): AccountProfileView {
  return { accountKind: null, givenName: "", familyName: "", companyName: "" };
}

export function accountProfileFromRow(row: {
  account_kind: string | null;
  given_name: string | null;
  family_name: string | null;
  company_name: string | null;
} | null): AccountProfileView {
  if (!row) return emptyAccountProfile();
  const accountKind = row.account_kind === "privat" || row.account_kind === "unternehmen"
    ? row.account_kind
    : null;
  return {
    accountKind,
    givenName: row.given_name ?? "",
    familyName: row.family_name ?? "",
    companyName: row.company_name ?? "",
  };
}

export function profileNeedsCompletion(profile: AccountProfileView | null): boolean {
  return profile?.accountKind !== "privat" && profile?.accountKind !== "unternehmen";
}
