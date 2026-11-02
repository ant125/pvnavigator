import { afterEach, describe, expect, it, vi } from "vitest";

import { CalculationNoticeError } from "./calculationNotice";
import { runHouseholdCalculationStream } from "./runHouseholdCalculationStream";

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection");
}

function sse(messages: unknown[]): Response {
  const body = messages.map((m) => `data: ${JSON.stringify(m)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runHouseholdCalculationStream", () => {
  it("surfaces the server's access explanation on 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            message:
              "Der kostenlose Zugang gilt für eine Adresse pro Konto; sie wurde mit Ihrer ersten erfolgreichen Berechnung festgelegt.",
            code: "free_address_mismatch",
            freeAddress: {
              label: "Hauptstraße 1, 80331 München",
              street: "Hauptstraße",
              houseNumber: "1",
              postalCode: "80331",
              city: "München",
            },
          },
          { status: 403 },
        ),
      ),
    );
    const error = await rejection(runHouseholdCalculationStream({}, () => {}));
    expect(error).toBeInstanceOf(CalculationNoticeError);
    const notice = error as CalculationNoticeError;
    expect(notice.kind).toBe("access");
    expect(notice.code).toBe("free_address_mismatch");
    expect(notice.freeAddress?.label).toBe("Hauptstraße 1, 80331 München");
    expect(notice.message).toMatch(/eine Adresse pro Konto/);
    expect(notice.addressLimit).toBeNull();
  });

  it("keeps the paid address limit on an exhausted quota", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            message: "Das Adresskontingent ist ausgeschöpft.",
            code: "subscription_limit_reached",
            addressLimit: 50,
          },
          { status: 403 },
        ),
      ),
    );
    const error = await rejection(runHouseholdCalculationStream({}, () => {}));
    expect(error).toBeInstanceOf(CalculationNoticeError);
    const notice = error as CalculationNoticeError;
    expect(notice.code).toBe("subscription_limit_reached");
    expect(notice.addressLimit).toBe(50);
    expect(notice.freeAddress).toBeNull();
  });

  it("flags a 503 from the access check as a service notice, not an input error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            message:
              "Die Zugangsprüfung ist derzeit nicht möglich. Bitte versuchen Sie es in einigen Minuten erneut.",
            code: "service_unavailable",
          },
          { status: 503 },
        ),
      ),
    );
    const error = await rejection(runHouseholdCalculationStream({}, () => {}));
    expect(error).toBeInstanceOf(CalculationNoticeError);
    expect((error as CalculationNoticeError).kind).toBe("unavailable");
    expect((error as Error).message).toMatch(/Zugangsprüfung ist derzeit nicht möglich/);
  });

  it("treats a 503 without code as unavailable too", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: "Wartung" }, { status: 503 })),
    );
    const error = await rejection(runHouseholdCalculationStream({}, () => {}));
    expect(error).toBeInstanceOf(CalculationNoticeError);
    expect((error as CalculationNoticeError).kind).toBe("unavailable");
  });

  it("surfaces a validation message on 400 as a plain input error and keeps the generic fallback otherwise", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: "Der Jahresstromverbrauch muss …" }, { status: 400 })),
    );
    const error = await rejection(runHouseholdCalculationStream({}, () => {}));
    expect(error).not.toBeInstanceOf(CalculationNoticeError);
    expect((error as Error).message).toBe("Der Jahresstromverbrauch muss …");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    await expect(runHouseholdCalculationStream({}, () => {})).rejects.toThrow(
      "Die Berechnung ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
    );
  });

  it("passes the saved id and the server-decided access tier through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sse([
          { type: "progress", event: { stage: "location" } },
          {
            type: "complete",
            payload: { displayAddress: "x" },
            calculationId: "22222222-2222-4222-8222-222222222222",
            accessTier: "free",
          },
        ]),
      ),
    );
    const progress = vi.fn();
    const result = await runHouseholdCalculationStream({}, progress);
    expect(progress).toHaveBeenCalledTimes(1);
    expect(result.calculationId).toBe("22222222-2222-4222-8222-222222222222");
    expect(result.accessTier).toBe("free");
  });

  it("treats a refusal at record time as an error, not as a result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sse([
          { type: "progress", event: { stage: "location" } },
          {
            type: "error",
            message: "Der kostenlose Zugang gilt für eine Adresse pro Konto …",
            code: "free_address_mismatch",
            freeAddress: {
              label: "Hauptstraße 1, 80331 München",
              street: "Hauptstraße",
              houseNumber: "1",
              postalCode: "80331",
              city: "München",
            },
          },
        ]),
      ),
    );
    const error = await rejection(runHouseholdCalculationStream({}, () => {}));
    expect(error).toBeInstanceOf(CalculationNoticeError);
    const notice = error as CalculationNoticeError;
    expect(notice.kind).toBe("access");
    expect(notice.freeAddress?.street).toBe("Hauptstraße");
  });

  it("treats a failed record step as a service notice and never yields a result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sse([
          { type: "progress", event: { stage: "location" } },
          {
            type: "error",
            message: "Die Zugangsprüfung ist derzeit nicht möglich. …",
            code: "service_unavailable",
          },
        ]),
      ),
    );
    const error = await rejection(runHouseholdCalculationStream({}, () => {}));
    expect(error).toBeInstanceOf(CalculationNoticeError);
    expect((error as CalculationNoticeError).kind).toBe("unavailable");
  });

  it("keeps a physics/geocoding error a plain input error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sse([{ type: "error", message: "Adresse nicht gefunden." }])),
    );
    const error = await rejection(runHouseholdCalculationStream({}, () => {}));
    expect(error).not.toBeInstanceOf(CalculationNoticeError);
    expect((error as Error).message).toBe("Adresse nicht gefunden.");
  });

  it("does not invent a tier when the report was not saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sse([{ type: "complete", payload: { displayAddress: "x" }, calculationId: null, accessTier: null }]),
      ),
    );
    const result = await runHouseholdCalculationStream({}, () => {});
    expect(result.calculationId).toBeNull();
    expect(result.accessTier).toBeNull();
  });
});
