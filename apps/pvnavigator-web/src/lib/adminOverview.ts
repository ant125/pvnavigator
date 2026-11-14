import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const USER_PAGE_SIZE = 20;
export const CALCULATION_PAGE_SIZE = 10;

const USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type AccountKind = "privat" | "unternehmen" | "nicht_angegeben";
export type UserSort = "registrierung" | "aktivitaet";
export type SortDirection = "ab" | "auf";

export type UserListQuery = {
  q: string;
  art: "alle" | AccountKind;
  sort: UserSort;
  richtung: SortDirection;
  seite: number;
};

export type AdminDashboard = {
  users: number;
  unternehmen: number;
  calculations: number;
  today: number;
  week: number;
  month: number;
  series: { day: string; count: number }[];
  trustpilotShown: number;
  trustpilotClicked: number;
};

export type AdminUser = {
  id: string;
  displayName: string | null;
  email: string | null;
  accountKind: AccountKind;
  registeredAt: string;
  calculationCount: number;
  lastCalculationAt: string | null;
  contactName: string | null;
};

export type AdminUserList = {
  total: number;
  page: number;
  pageSize: number;
  users: AdminUser[];
};

export type AdminCalculation = {
  createdAt: string;
  address: string | null;
  pvKwp: number | null;
  consumptionKwh: number | null;
  pvYieldKwh: number | null;
  speichergrenzeKwh: number | null;
};

export type AdminUserCard = {
  user: AdminUser;
  page: number;
  pageSize: number;
  calculations: AdminCalculation[];
};

export type AdminLoadResult<T> =
  | { status: "ok"; data: T }
  | { status: "missing" }
  | { status: "error" };

type RpcError = { message: string; code?: string } | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function count(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function quantity(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function text(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function instant(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function accountKind(value: unknown): AccountKind | null {
  if (value === "privat" || value === "unternehmen" || value === "nicht_angegeben") return value;
  return null;
}

function one(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

export function isAdminUserId(value: string): boolean {
  return USER_ID_RE.test(value);
}

export function parseUserListQuery(
  params: Record<string, string | string[] | undefined>,
): UserListQuery {
  const art = one(params, "art");
  const sort = one(params, "sort");
  const richtung = one(params, "richtung");
  const seite = Number(one(params, "seite"));
  return {
    q: one(params, "q").slice(0, 200),
    art: art === "privat" || art === "unternehmen" || art === "nicht_angegeben" ? art : "alle",
    sort: sort === "aktivitaet" ? "aktivitaet" : "registrierung",
    richtung: richtung === "auf" ? "auf" : "ab",
    seite: Number.isInteger(seite) && seite > 0 ? Math.min(seite, 100000) : 1,
  };
}

export function parsePage(params: Record<string, string | string[] | undefined>): number {
  const seite = Number(one(params, "seite"));
  return Number.isInteger(seite) && seite > 0 ? Math.min(seite, 100000) : 1;
}

export function userListHref(query: UserListQuery, patch: Partial<UserListQuery> = {}): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.art !== "alle") params.set("art", next.art);
  if (next.sort !== "registrierung") params.set("sort", next.sort);
  if (next.richtung !== "ab") params.set("richtung", next.richtung);
  if (next.seite > 1) params.set("seite", String(next.seite));
  const search = params.toString();
  return search ? `/admin/nutzer?${search}` : "/admin/nutzer";
}

export function pageCount(total: number, pageSize: number): number {
  if (pageSize < 1) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function accountKindLabel(kind: AccountKind): string {
  if (kind === "privat") return "Privatperson";
  if (kind === "unternehmen") return "Unternehmen";
  return "Nicht angegeben";
}

export function formatAdminCount(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

/** Clicked accounts divided by accounts who were shown the invitation. */
export function formatAdminRate(shown: number, clicked: number): string {
  if (!Number.isFinite(shown) || shown <= 0) return "—";
  const pct = (clicked / shown) * 100;
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(pct)} %`;
}

export function formatAdminDay(day: string): string {
  const [year, month, date] = day.split("-");
  if (!year || !month || !date) return day;
  return `${date}.${month}.${year}`;
}

export function formatAdminDateTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));
}

export function formatAdminKwh(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} kWh`;
}

function parseUser(value: unknown): AdminUser | null {
  if (!isRecord(value) || typeof value.id !== "string" || !isAdminUserId(value.id)) return null;
  const kind = accountKind(value.account_kind);
  const registeredAt = instant(value.registered_at);
  const calculationCount = count(value.calculation_count);
  if (!kind || !registeredAt || calculationCount === null) return null;
  const lastCalculationAt = value.last_calculation_at == null ? null : instant(value.last_calculation_at);
  if (value.last_calculation_at != null && lastCalculationAt === null) return null;
  if (value.display_name != null && typeof value.display_name !== "string") return null;
  if (value.email != null && typeof value.email !== "string") return null;
  if (value.contact_name != null && typeof value.contact_name !== "string") return null;
  return {
    id: value.id,
    displayName: text(value.display_name),
    email: text(value.email),
    accountKind: kind,
    registeredAt,
    calculationCount,
    lastCalculationAt,
    contactName: text(value.contact_name),
  };
}

export function parseAdminDashboard(value: unknown): AdminDashboard | null {
  if (!isRecord(value) || !Array.isArray(value.series) || value.series.length !== 30) return null;
  const users = count(value.users);
  const unternehmen = count(value.unternehmen);
  const calculations = count(value.calculations);
  const today = count(value.today);
  const week = count(value.week);
  const month = count(value.month);
  const trustpilotShown = count(value.trustpilot_shown);
  const trustpilotClicked = count(value.trustpilot_clicked);
  if (
    users === null || unternehmen === null || calculations === null
    || today === null || week === null || month === null
    || trustpilotShown === null || trustpilotClicked === null
  ) {
    return null;
  }
  const series: AdminDashboard["series"] = [];
  for (const point of value.series) {
    if (!isRecord(point) || typeof point.day !== "string" || !DAY_RE.test(point.day)) return null;
    const pointCount = count(point.count);
    if (pointCount === null) return null;
    series.push({ day: point.day, count: pointCount });
  }
  return {
    users,
    unternehmen,
    calculations,
    today,
    week,
    month,
    series,
    trustpilotShown,
    trustpilotClicked,
  };
}

export function parseAdminUserList(value: unknown): AdminUserList | null {
  if (!isRecord(value) || !Array.isArray(value.users)) return null;
  const total = count(value.total);
  const page = count(value.page);
  const pageSize = count(value.page_size);
  if (total === null || page === null || pageSize === null || page < 1 || pageSize < 1) return null;
  if (value.users.length > pageSize) return null;
  const users: AdminUser[] = [];
  for (const entry of value.users) {
    const user = parseUser(entry);
    if (!user) return null;
    users.push(user);
  }
  return { total, page, pageSize, users };
}

function parseCalculation(value: unknown): AdminCalculation | null {
  if (!isRecord(value)) return null;
  const createdAt = instant(value.created_at);
  if (!createdAt) return null;
  if (value.address !== null && typeof value.address !== "string") return null;
  const pvKwp = quantity(value.pv_kwp);
  const consumptionKwh = quantity(value.consumption_kwh);
  const pvYieldKwh = quantity(value.pv_yield_kwh);
  const speichergrenzeKwh = quantity(value.speichergrenze_kwh);
  if (
    (value.pv_kwp !== null && pvKwp === null)
    || (value.consumption_kwh !== null && consumptionKwh === null)
    || (value.pv_yield_kwh !== null && pvYieldKwh === null)
    || (value.speichergrenze_kwh !== null && speichergrenzeKwh === null)
  ) {
    return null;
  }
  return {
    createdAt,
    address: text(value.address),
    pvKwp,
    consumptionKwh,
    pvYieldKwh,
    speichergrenzeKwh,
  };
}

export function parseAdminUserCard(value: unknown): AdminUserCard | null {
  if (!isRecord(value) || !Array.isArray(value.calculations)) return null;
  const user = parseUser(value.user);
  const page = count(value.page);
  const pageSize = count(value.page_size);
  if (!user || page === null || pageSize === null || page < 1 || pageSize < 1) return null;
  if (value.calculations.length > pageSize) return null;
  const calculations: AdminCalculation[] = [];
  for (const entry of value.calculations) {
    const calculation = parseCalculation(entry);
    if (!calculation) return null;
    calculations.push(calculation);
  }
  return { user, page, pageSize, calculations };
}

function missingSubject(error: RpcError): boolean {
  return error?.code === "P0002" || error?.message.includes("admin_subject_not_found") === true;
}

export async function loadAdminDashboard(): Promise<AdminLoadResult<AdminDashboard>> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("admin_dashboard");
  const dashboard = error ? null : parseAdminDashboard(data);
  if (!dashboard) {
    console.error("Failed to load the administrator dashboard", error);
    return { status: "error" };
  }
  return { status: "ok", data: dashboard };
}

export async function loadAdminUserList(query: UserListQuery): Promise<AdminLoadResult<AdminUserList>> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_query: query.q,
    p_kind: query.art,
    p_sort: query.sort,
    p_direction: query.richtung === "auf" ? "asc" : "desc",
    p_page: query.seite,
    p_page_size: USER_PAGE_SIZE,
  });
  const list = error ? null : parseAdminUserList(data);
  if (!list) {
    console.error("Failed to load the administrator user list", error);
    return { status: "error" };
  }
  return { status: "ok", data: list };
}

export async function loadAdminUserCard(
  userId: string,
  page: number,
): Promise<AdminLoadResult<AdminUserCard>> {
  await requireAdmin();
  if (!isAdminUserId(userId)) notFound();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("admin_user_card", {
    p_user_id: userId,
    p_page: page,
    p_page_size: CALCULATION_PAGE_SIZE,
  });
  if (missingSubject(error)) return { status: "missing" };
  const card = error ? null : parseAdminUserCard(data);
  if (!card || card.user.id !== userId) {
    console.error("Failed to load the administrator user card", error);
    return { status: "error" };
  }
  return { status: "ok", data: card };
}
