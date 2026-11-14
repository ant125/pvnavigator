import { getSpeicherGrenzeResultUrl } from "@pv-auth/session";

export const SPEICHER_GRENZE_PRODUCT_KEY = "speicher_grenze";

export type CalculationListRow = {
  id: string;
  address_key?: string | null;
  heat_pump_enabled?: boolean | null;
  heat_pump_consumption_kwh?: number | null;
  ev_enabled?: boolean | null;
  ev_annual_km?: number | null;
  ev_consumption_per_100km?: number | null;
  product_key: string;
  name: string;
  summary_address: string | null;
  summary_pv_kwp: number | null;
  summary_consumption_kwh: number | null;
  created_at: string;
  updated_at: string;
  /** free | paid, decided server-side; null for rows before the access rules. */
  access_tier?: string | null;
};

const PRODUCT_LABELS: Record<string, string> = {
  [SPEICHER_GRENZE_PRODUCT_KEY]: "SPEICHERGRENZE",
  wirtschaftlichkeit: "RENDITEGUIDE",
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
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(
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
  "id, product_key, name, summary_address, summary_pv_kwp, summary_consumption_kwh, created_at, updated_at, access_tier, address_key, heat_pump_enabled:input->heatPumpEnabled, heat_pump_consumption_kwh:input->heatPumpConsumptionKWh, ev_enabled:input->ev->enabled, ev_annual_km:input->ev->annualKm, ev_consumption_per_100km:input->ev->consumptionKwhPer100Km";

export function calculationResultHref(row: CalculationListRow): string | null {
  if (row.product_key !== SPEICHER_GRENZE_PRODUCT_KEY) return null;
  return getSpeicherGrenzeResultUrl(row.id);
}

export function groupCalculations(rows: CalculationListRow[], query = "") {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
  const terms = normalize(query).split(" ").filter(Boolean);
  const services = new Map<string, { productKey: string; addresses: Map<string, { key: string; label: string; rows: CalculationListRow[] }> }>();
  const sorted = [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
  const knownKeys = new Map<string, Set<string>>();
  for (const row of sorted) {
    if (row.address_key?.trim() && row.summary_address?.trim()) {
      const labelKey = JSON.stringify([row.product_key, normalize(row.summary_address)]);
      const keys = knownKeys.get(labelKey) ?? new Set<string>();
      keys.add(row.address_key.trim()); knownKeys.set(labelKey, keys);
    }
  }
  for (const row of sorted) {
    const text = normalize(`${row.summary_address ?? ""} ${row.name} ${productLabel(row.product_key)}`);
    if (!terms.every(term => text.includes(term))) continue;
    let service = services.get(row.product_key);
    if (!service) { service = {productKey: row.product_key, addresses: new Map()}; services.set(row.product_key, service); }
    const address = row.summary_address?.trim();
    // Never merge unidentified historical objects merely because they share a name.
    const candidates = address ? knownKeys.get(JSON.stringify([row.product_key, normalize(address)])) : undefined;
    const inferredKey = candidates?.size === 1 ? Array.from(candidates)[0] : undefined;
    const key = row.address_key?.trim() || inferredKey || (address ? `label:${normalize(address)}` : `report:${row.id}`);
    let group = service.addresses.get(key);
    if (!group) { group = {key, label: address || row.name || "Adresse nicht gespeichert", rows: []}; service.addresses.set(key, group); }
    group.rows.push(row);
  }
  return Array.from(services.values(), service => ({productKey: service.productKey, addresses: Array.from(service.addresses.values())}));
}

export function heatPumpSummary(row: CalculationListRow): string {
  if (row.heat_pump_enabled === false) return "Ohne Wärmepumpe";
  if (row.heat_pump_enabled !== true) return "Nicht gespeichert";
  const consumption = formatListingKwh(row.heat_pump_consumption_kwh ?? null);
  return consumption ? `Mit · ${consumption}` : "Mit Wärmepumpe";
}
export function evSummary(row: CalculationListRow): string {
  if (row.ev_enabled === false) return "Ohne Elektroauto";
  if (row.ev_enabled !== true) return "Nicht gespeichert";
  const km = row.ev_annual_km;
  const parts = ["Mit"];
  if (km != null && Number.isFinite(Number(km))) parts.push(`${new Intl.NumberFormat("de-DE").format(Number(km))} km/a`);
  const consumption = row.ev_consumption_per_100km;
  if (consumption != null && Number.isFinite(Number(consumption))) parts.push(`${new Intl.NumberFormat("de-DE").format(Number(consumption))} kWh/100 km`);
  return parts.length > 1 ? parts.join(" · ") : "Mit Elektroauto";
}
