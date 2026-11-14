import { describe, expect, it } from "vitest";

import { shouldReturnToPreviousPage } from "./infoBack";

const origin = "https://pvnavigator.de";

describe("shouldReturnToPreviousPage", () => {
  it("goes home when the page was opened directly", () => {
    expect(
      shouldReturnToPreviousPage({
        currentHref: `${origin}/kontakt`,
        referrer: "",
        historyLength: 1,
        navigationEntryUrl: `${origin}/kontakt`,
      }),
    ).toBe(false);
  });

  it("goes home when the visit came from another site", () => {
    expect(
      shouldReturnToPreviousPage({
        currentHref: `${origin}/impressum`,
        referrer: "https://www.google.com/search?q=pvnavigator",
        historyLength: 2,
        navigationEntryUrl: `${origin}/impressum`,
      }),
    ).toBe(false);
  });

  it("returns to the previous PVNAVIGATOR_ page after an internal visit", () => {
    expect(
      shouldReturnToPreviousPage({
        currentHref: `${origin}/datenschutz`,
        referrer: `${origin}/impressum`,
        historyLength: 2,
        navigationEntryUrl: `${origin}/datenschutz`,
      }),
    ).toBe(true);
  });

  it("returns within the site after moving on from the landing page", () => {
    expect(
      shouldReturnToPreviousPage({
        currentHref: `${origin}/kontakt`,
        referrer: "https://www.google.com/",
        historyLength: 3,
        navigationEntryUrl: `${origin}/`,
      }),
    ).toBe(true);
  });

  it("does not treat a same-page query as a further internal step", () => {
    expect(
      shouldReturnToPreviousPage({
        currentHref: `${origin}/kontakt?utm=mail`,
        referrer: "https://example.com",
        historyLength: 2,
        navigationEntryUrl: `${origin}/kontakt`,
      }),
    ).toBe(false);
  });
});
