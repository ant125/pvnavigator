export const SPEICHER_GRENZE_PRODUCT_KEY = "speicher_grenze";

export type CalculationListRow = {
  id: string;
  product_key: string;
  name: string;
  summary_address: string | null;
  summary_pv_kwp: number | null;
  summary_consumption_kwh: number | null;
  created_at: string;
  updated_at: string;
};

const PRODUCT_LABELS: Record<string, string> = {
  [SPEICHER_GRENZE_PRODUCT_KEY]: "SpeicherGrenze",
  wirtschaftlichkeit: "Wirtschaftlichkeitsanalyse",
  pvshadow: "PVShadow",
};

export function productLabel(productKey: string): string {
  return PRODUCT_LABELS[productKey] ?? productKey;
}

export function calculationDisplayName(row: CalculationListRow): string {
  const address = row.summary_address?.trim();
  if (address) return address;
  return row.name;
}

export function formatListingDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export function formatListingKwP(value: number | null): string | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(n)} kWp`;
}

export function formatListingKwh(value: number | null): string | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n)} kWh/a`;
}

export const CALCULATION_LIST_SELECT =
  "id, product_key, name, summary_address, summary_pv_kwp, summary_consumption_kwh, created_at, updated_at";
