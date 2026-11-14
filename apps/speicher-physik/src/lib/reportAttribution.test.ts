import { describe, expect, it } from "vitest";

import {
  freezeReportAttribution,
  parseReportClient,
  reportAttributionFromStoredInput,
  reportClientLabel,
} from "./reportAttribution";

describe("report attribution", () => {
  it("keeps a company name and the client entered for this calculation", () => {
    const frozen = freezeReportAttribution({
      accountKind: "unternehmen",
      companyName: "  Analytical   Engines GmbH ",
      client: parseReportClient({ givenName: " Grace ", familyName: "Hopper" }),
    });
    expect(frozen).toEqual({
      companyName: "Analytical Engines GmbH",
      clientGivenName: "Grace",
      clientFamilyName: "Hopper",
    });
    expect(frozen ? reportClientLabel(frozen) : "").toBe("Grace Hopper");
  });

  it("stores nothing for a private account, even when a client name is sent", () => {
    expect(freezeReportAttribution({
      accountKind: "privat",
      companyName: "Should not appear",
      client: { givenName: "Ada", familyName: "Lovelace" },
    })).toBeNull();
    expect(freezeReportAttribution({
      accountKind: null,
      companyName: "Offen",
      client: { givenName: "Ada", familyName: "Lovelace" },
    })).toBeNull();
  });

  it("rejects a company report without both client names or a Firmenname", () => {
    expect(parseReportClient({ givenName: "Grace", familyName: "  " })).toBeNull();
    expect(freezeReportAttribution({
      accountKind: "unternehmen",
      companyName: "Bombe Ltd",
      client: null,
    })).toBeNull();
    expect(freezeReportAttribution({
      accountKind: "unternehmen",
      companyName: "",
      client: { givenName: "Grace", familyName: "Hopper" },
    })).toBeNull();
  });

  it("reads only a complete snapshot and ignores a later profile", () => {
    expect(reportAttributionFromStoredInput({
      street: "Musterstraße",
      reportAttribution: {
        companyName: "Bombe Ltd",
        clientGivenName: "Grace",
        clientFamilyName: "Hopper",
      },
    })).toEqual({
      companyName: "Bombe Ltd",
      clientGivenName: "Grace",
      clientFamilyName: "Hopper",
    });
    expect(reportAttributionFromStoredInput({ street: "Musterstraße" })).toBeNull();
    expect(reportAttributionFromStoredInput({
      reportAttribution: { companyName: "Bombe Ltd" },
    })).toBeNull();
  });
});
