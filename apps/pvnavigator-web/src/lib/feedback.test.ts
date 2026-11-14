import { describe, expect, it } from "vitest";

import {
  feedbackErrorCode,
  parseAdminFeedbackThread,
  parseFeedbackDraft,
  parseFeedbackThread,
} from "./feedback";

const threadId = "00000000-0000-4000-8000-000000000010";
const userId = "00000000-0000-4000-8000-0000000000aa";
const calculationId = "00000000-0000-4000-8000-000000000001";
const messageId = "00000000-0000-4000-8000-000000000020";

const summary = {
  id: threadId,
  product_key: "speicher_grenze",
  category: "fehler",
  subject: "Anzeige springt",
  status: "neu",
  calculation_id: calculationId,
  created_at: "2026-11-14T18:00:00.000Z",
  updated_at: "2026-11-14T18:00:00.000Z",
  unread: true,
};

describe("feedback draft", () => {
  const valid = {
    productKey: "speicher_grenze",
    category: "fehler",
    subject: "  Anzeige  ",
    body: "  Der Wert fehlt.  ",
    calculationId: calculationId,
  };

  it("keeps an own calculation only for SPEICHERGRENZE", () => {
    expect(parseFeedbackDraft(valid)).toEqual({
      productKey: "speicher_grenze",
      category: "fehler",
      subject: "Anzeige",
      body: "Der Wert fehlt.",
      calculationId,
    });
    expect(parseFeedbackDraft({ ...valid, calculationId: "" })?.calculationId).toBeNull();
  });

  it("rejects a calculation for a general idea and an unknown product", () => {
    expect(parseFeedbackDraft({ ...valid, productKey: "allgemein", calculationId: "" })).toMatchObject({
      productKey: "allgemein",
      calculationId: null,
    });
    expect(parseFeedbackDraft({ ...valid, productKey: "allgemein" })).toBeNull();
    expect(parseFeedbackDraft({ ...valid, productKey: "wirtschaftlichkeit" })).toBeNull();
    expect(parseFeedbackDraft({ ...valid, productKey: "other" })).toBeNull();
    expect(parseFeedbackDraft({ ...valid, calculationId: "not-a-calculation" })).toBeNull();
  });
});

describe("feedback payloads", () => {
  it("reads a user thread without an e-mail address or a report", () => {
    const thread = parseFeedbackThread({
      ...summary,
      email: "person@example.com",
      input: { secret: true },
      messages: [{ id: messageId, body: "Der Wert fehlt.", author_role: "user", created_at: summary.created_at }],
    });
    expect(thread?.messages).toHaveLength(1);
    expect(thread).not.toHaveProperty("email");
    expect(JSON.stringify(thread)).not.toContain("secret");
  });

  it("reads an administrator thread with the calculation id and without the snapshot", () => {
    const thread = parseAdminFeedbackThread({
      ...summary,
      user_id: userId,
      email: "person@example.com",
      display_name: "Ada Lovelace",
      account_kind: "privat",
      battery_model_version: "1.1.0",
      input_schema_version: "1",
      result_schema_version: "1",
      result_snapshot: { full: true },
      messages: [{ id: messageId, body: "Wir prüfen das.", author_role: "admin", created_at: summary.created_at }],
    });
    expect(thread?.email).toBe("person@example.com");
    expect(thread?.calculationId).toBe(calculationId);
    expect(thread?.batteryModelVersion).toBe("1.1.0");
    expect(JSON.stringify(thread)).not.toContain("result_snapshot");
    expect(JSON.stringify(thread)).not.toContain("full");
  });

  it("maps database errors to short hints", () => {
    expect(feedbackErrorCode({ message: "feedback_rate_limited" })).toBe("limit");
    expect(feedbackErrorCode({ message: "feedback_calculation_not_found" })).toBe("berechnung");
    expect(feedbackErrorCode({ message: "feedback_invalid" })).toBe("ungueltig");
    expect(feedbackErrorCode({ message: "feedback_not_found" })).toBe("fehler");
  });
});
