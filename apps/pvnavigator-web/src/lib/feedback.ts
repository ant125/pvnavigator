import { isPvNavigatorUuid } from "@pv-auth/session";

export const FEEDBACK_PRODUCTS = [
  { key: "speicher_grenze", label: "SPEICHERGRENZE" },
  { key: "allgemein", label: "PVNAVIGATOR_ / Allgemeine Idee" },
] as const;

export const FEEDBACK_CATEGORIES = [
  { key: "fehler", label: "Fehler melden" },
  { key: "verbesserung", label: "Verbesserung vorschlagen" },
] as const;

export const FEEDBACK_STATUSES = [
  { key: "neu", label: "Neu" },
  { key: "in_bearbeitung", label: "In Bearbeitung" },
  { key: "beantwortet", label: "Beantwortet" },
  { key: "erledigt", label: "Erledigt" },
] as const;

export type FeedbackProductKey = (typeof FEEDBACK_PRODUCTS)[number]["key"];
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["key"];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]["key"];
export type FeedbackAuthorRole = "user" | "admin";

export type FeedbackThreadSummary = {
  id: string;
  productKey: FeedbackProductKey | "wirtschaftlichkeit";
  category: FeedbackCategory;
  subject: string;
  status: FeedbackStatus;
  calculationId: string | null;
  createdAt: string;
  updatedAt: string;
  unread: boolean;
};

export type FeedbackMessage = {
  id: string;
  body: string;
  authorRole: FeedbackAuthorRole;
  createdAt: string;
};

export type FeedbackThread = FeedbackThreadSummary & {
  messages: FeedbackMessage[];
};

export type FeedbackCalculationOption = {
  id: string;
  label: string;
};

export type FeedbackDraft = {
  productKey: FeedbackProductKey;
  category: FeedbackCategory;
  subject: string;
  body: string;
  calculationId: string | null;
};

export type AdminFeedbackThreadSummary = FeedbackThreadSummary & {
  userId: string;
  email: string | null;
  displayName: string | null;
  accountKind: "privat" | "unternehmen" | "nicht_angegeben";
};

export type AdminFeedbackList = {
  total: number;
  page: number;
  pageSize: number;
  threads: AdminFeedbackThreadSummary[];
};

export type AdminFeedbackThread = AdminFeedbackThreadSummary & {
  batteryModelVersion: string | null;
  inputSchemaVersion: string | null;
  resultSchemaVersion: string | null;
  messages: FeedbackMessage[];
};

const PRODUCT_LABELS: Record<FeedbackThreadSummary["productKey"], string> = {
  speicher_grenze: "SPEICHERGRENZE",
  allgemein: "PVNAVIGATOR_ / Allgemeine Idee",
  wirtschaftlichkeit: "RENDITEGUIDE",
};

export function feedbackProductLabel(key: FeedbackThreadSummary["productKey"]): string {
  return PRODUCT_LABELS[key];
}

export function feedbackCategoryLabel(key: FeedbackCategory): string {
  return FEEDBACK_CATEGORIES.find((item) => item.key === key)?.label ?? key;
}

export function feedbackStatusLabel(key: FeedbackStatus): string {
  return FEEDBACK_STATUSES.find((item) => item.key === key)?.label ?? key;
}

export function formatFeedbackDateTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));
}

export function feedbackHint(code: string | undefined): string | null {
  if (code === "ungueltig") return "Bitte prüfen Sie Produkt, Kategorie, Betreff und Nachricht.";
  if (code === "limit") {
    return "Sie haben das Limit für neue Anfragen oder Nachrichten erreicht. Bitte versuchen Sie es später erneut.";
  }
  if (code === "berechnung") return "Die gewählte Berechnung gehört nicht zu diesem Produkt.";
  if (code === "fehler") return "Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.";
  return null;
}

export function feedbackErrorCode(error: { message?: string } | null): "ungueltig" | "limit" | "berechnung" | "fehler" {
  const message = error?.message ?? "";
  if (message.includes("feedback_rate_limited")) return "limit";
  if (message.includes("feedback_calculation_not_found")) return "berechnung";
  if (message.includes("feedback_invalid")) return "ungueltig";
  return "fehler";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) return null;
  return trimmed;
}

function instant(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function productKey(value: unknown): FeedbackThreadSummary["productKey"] | null {
  if (value === "speicher_grenze" || value === "allgemein" || value === "wirtschaftlichkeit") return value;
  return null;
}

function category(value: unknown): FeedbackCategory | null {
  if (value === "fehler" || value === "verbesserung") return value;
  return null;
}

function status(value: unknown): FeedbackStatus | null {
  if (value === "neu" || value === "in_bearbeitung" || value === "beantwortet" || value === "erledigt") {
    return value;
  }
  return null;
}

function optionalUuid(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string" && isPvNavigatorUuid(value)) return value.toLowerCase();
  return undefined;
}

function parseSummary(value: unknown): FeedbackThreadSummary | null {
  if (!isRecord(value) || typeof value.id !== "string" || !isPvNavigatorUuid(value.id)) return null;
  const key = productKey(value.product_key);
  const kind = category(value.category);
  const threadStatus = status(value.status);
  const subject = text(value.subject, 120);
  const createdAt = instant(value.created_at);
  const updatedAt = instant(value.updated_at);
  const calculationId = optionalUuid(value.calculation_id);
  if (!key || !kind || !threadStatus || !subject || !createdAt || !updatedAt || calculationId === undefined) {
    return null;
  }
  if (typeof value.unread !== "boolean") return null;
  return {
    id: value.id.toLowerCase(),
    productKey: key,
    category: kind,
    subject,
    status: threadStatus,
    calculationId,
    createdAt,
    updatedAt,
    unread: value.unread,
  };
}

function parseMessage(value: unknown): FeedbackMessage | null {
  if (!isRecord(value) || typeof value.id !== "string" || !isPvNavigatorUuid(value.id)) return null;
  const body = text(value.body, 4000);
  const createdAt = instant(value.created_at);
  if (!body || !createdAt) return null;
  if (value.author_role !== "user" && value.author_role !== "admin") return null;
  return {
    id: value.id.toLowerCase(),
    body,
    authorRole: value.author_role,
    createdAt,
  };
}

export function parseFeedbackThreads(value: unknown): FeedbackThreadSummary[] | null {
  if (!Array.isArray(value)) return null;
  const threads: FeedbackThreadSummary[] = [];
  for (const entry of value) {
    const thread = parseSummary(entry);
    if (!thread) return null;
    threads.push(thread);
  }
  return threads;
}

export function parseFeedbackThread(value: unknown): FeedbackThread | null {
  const summary = parseSummary(value);
  if (!summary || !isRecord(value) || !Array.isArray(value.messages)) return null;
  const messages: FeedbackMessage[] = [];
  for (const entry of value.messages) {
    const message = parseMessage(entry);
    if (!message) return null;
    messages.push(message);
  }
  return { ...summary, messages };
}

function accountKind(value: unknown): AdminFeedbackThreadSummary["accountKind"] | null {
  if (value === "privat" || value === "unternehmen" || value === "nicht_angegeben") return value;
  return null;
}

function parseAdminSummary(value: unknown): AdminFeedbackThreadSummary | null {
  const summary = parseSummary(value);
  if (!summary || !isRecord(value) || typeof value.user_id !== "string" || !isPvNavigatorUuid(value.user_id)) {
    return null;
  }
  const kind = accountKind(value.account_kind);
  if (!kind) return null;
  if (value.email !== null && typeof value.email !== "string") return null;
  if (value.display_name !== null && typeof value.display_name !== "string") return null;
  return {
    ...summary,
    userId: value.user_id.toLowerCase(),
    email: value.email,
    displayName: typeof value.display_name === "string" && value.display_name.trim() ? value.display_name.trim() : null,
    accountKind: kind,
  };
}

export function parseAdminFeedbackList(value: unknown): AdminFeedbackList | null {
  if (!isRecord(value) || !Array.isArray(value.threads)) return null;
  const total = value.total;
  const page = value.page;
  const pageSize = value.page_size;
  if (
    typeof total !== "number" || !Number.isInteger(total) || total < 0
    || typeof page !== "number" || !Number.isInteger(page) || page < 1
    || typeof pageSize !== "number" || !Number.isInteger(pageSize) || pageSize < 1
    || value.threads.length > pageSize
  ) {
    return null;
  }
  const threads: AdminFeedbackThreadSummary[] = [];
  for (const entry of value.threads) {
    const thread = parseAdminSummary(entry);
    if (!thread) return null;
    threads.push(thread);
  }
  return { total, page, pageSize, threads };
}

function optionalVersion(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 80) return undefined;
  return trimmed;
}

export function parseAdminFeedbackThread(value: unknown): AdminFeedbackThread | null {
  const summary = parseAdminSummary(value);
  if (!summary || !isRecord(value) || !Array.isArray(value.messages)) return null;
  const batteryModelVersion = optionalVersion(value.battery_model_version);
  const inputSchemaVersion = optionalVersion(value.input_schema_version);
  const resultSchemaVersion = optionalVersion(value.result_schema_version);
  if (batteryModelVersion === undefined || inputSchemaVersion === undefined || resultSchemaVersion === undefined) {
    return null;
  }
  const messages: FeedbackMessage[] = [];
  for (const entry of value.messages) {
    const message = parseMessage(entry);
    if (!message) return null;
    messages.push(message);
  }
  return { ...summary, batteryModelVersion, inputSchemaVersion, resultSchemaVersion, messages };
}

export function parseFeedbackDraft(input: {
  productKey: unknown;
  category: unknown;
  subject: unknown;
  body: unknown;
  calculationId: unknown;
}): FeedbackDraft | null {
  const key = input.productKey === "speicher_grenze" || input.productKey === "allgemein" ? input.productKey : null;
  const kind = input.category === "fehler" || input.category === "verbesserung" ? input.category : null;
  const subject = text(input.subject, 120);
  const body = text(input.body, 4000);
  if (!key || !kind || !subject || !body) return null;
  const rawCalculation = typeof input.calculationId === "string" ? input.calculationId.trim() : "";
  if (key === "allgemein") return rawCalculation ? null : { productKey: key, category: kind, subject, body, calculationId: null };
  if (!rawCalculation) return { productKey: key, category: kind, subject, body, calculationId: null };
  if (!isPvNavigatorUuid(rawCalculation)) return null;
  return { productKey: key, category: kind, subject, body, calculationId: rawCalculation.toLowerCase() };
}

export function parseFeedbackStatus(value: unknown): FeedbackStatus | null {
  return status(value);
}
