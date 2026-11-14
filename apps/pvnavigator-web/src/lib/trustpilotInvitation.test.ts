import { describe, expect, it } from "vitest";

import {
  TRUSTPILOT_REVIEW_LOCALE,
  TRUSTPILOT_REVIEW_URL,
  trustpilotInvitationForAccount,
} from "./trustpilotInvitation";

const ready = {
  trustpilotShownAt: null,
  trustpilotClickedAt: null,
  error: false,
};

describe("Trustpilot invitation eligibility", () => {
  it("uses the account review link without account data", () => {
    expect(TRUSTPILOT_REVIEW_LOCALE).toBe("en-US");
    expect(TRUSTPILOT_REVIEW_URL).toBe("https://www.trustpilot.com/review/pvnavigator.de");
    expect(TRUSTPILOT_REVIEW_URL).not.toContain("?");
    expect(TRUSTPILOT_REVIEW_URL).not.toContain("@");
  });

  it("shows a private account after the first saved calculation", () => {
    expect(trustpilotInvitationForAccount({ ...ready, accountKind: "privat", savedCalculations: 0 })).toEqual({
      show: false,
      recordShown: false,
    });
    expect(trustpilotInvitationForAccount({ ...ready, accountKind: "privat", savedCalculations: 1 })).toEqual({
      show: true,
      recordShown: true,
    });
  });

  it("shows a company account after the third saved calculation", () => {
    expect(trustpilotInvitationForAccount({ ...ready, accountKind: "unternehmen", savedCalculations: 2 })).toEqual({
      show: false,
      recordShown: false,
    });
    expect(trustpilotInvitationForAccount({ ...ready, accountKind: "unternehmen", savedCalculations: 3 })).toEqual({
      show: true,
      recordShown: true,
    });
  });

  it("keeps an existing shown stamp and hides a stored click", () => {
    expect(trustpilotInvitationForAccount({
      accountKind: "privat",
      savedCalculations: 4,
      trustpilotShownAt: "2026-11-14T18:00:00.000Z",
      trustpilotClickedAt: null,
      error: false,
    })).toEqual({ show: true, recordShown: false });
    expect(trustpilotInvitationForAccount({
      accountKind: "unternehmen",
      savedCalculations: 4,
      trustpilotShownAt: "2026-11-14T18:00:00.000Z",
      trustpilotClickedAt: "2026-11-14T18:05:00.000Z",
      error: false,
    })).toEqual({ show: false, recordShown: false });
  });

  it("hides the invitation when the account type or the count cannot be verified", () => {
    expect(trustpilotInvitationForAccount({ ...ready, accountKind: null, savedCalculations: 5 })).toEqual({
      show: false,
      recordShown: false,
    });
    expect(trustpilotInvitationForAccount({ ...ready, accountKind: "privat", savedCalculations: 1, error: true })).toEqual({
      show: false,
      recordShown: false,
    });
    expect(trustpilotInvitationForAccount({ ...ready, accountKind: "privat", savedCalculations: 1.5 })).toEqual({
      show: false,
      recordShown: false,
    });
  });
});
