import { describe, expect, it } from "vitest";

import {
  TRUSTPILOT_REVIEW_LOCALE,
  TRUSTPILOT_REVIEW_URL,
  trustpilotInvitationFromRow,
} from "./trustpilotInvitation";

describe("Trustpilot invitation state", () => {
  it("uses the account review link without account data", () => {
    expect(TRUSTPILOT_REVIEW_LOCALE).toBe("en-US");
    expect(TRUSTPILOT_REVIEW_URL).toBe("https://www.trustpilot.com/review/pvnavigator.de");
    expect(TRUSTPILOT_REVIEW_URL).not.toContain("?");
    expect(TRUSTPILOT_REVIEW_URL).not.toContain("@");
  });

  it("shows the invitation once, until the link has been opened", () => {
    expect(trustpilotInvitationFromRow(null, false)).toEqual({
      show: false,
      recordShown: false,
    });
    expect(trustpilotInvitationFromRow({ trustpilot_clicked_at: null }, true)).toEqual({
      show: false,
      recordShown: false,
    });
    expect(
      trustpilotInvitationFromRow(
        { trustpilot_clicked_at: null, trustpilot_shown_at: null },
        false,
      ),
    ).toEqual({ show: true, recordShown: true });
    expect(
      trustpilotInvitationFromRow(
        {
          trustpilot_clicked_at: null,
          trustpilot_shown_at: "2026-11-14T18:00:00.000Z",
        },
        false,
      ),
    ).toEqual({ show: true, recordShown: false });
    expect(
      trustpilotInvitationFromRow(
        {
          trustpilot_clicked_at: "2026-11-14T18:05:00.000Z",
          trustpilot_shown_at: "2026-11-14T18:00:00.000Z",
        },
        false,
      ),
    ).toEqual({ show: false, recordShown: false });
  });
});
