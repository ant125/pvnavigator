/** @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { recordTrustpilotClick, recordTrustpilotShown } = vi.hoisted(() => ({
  recordTrustpilotClick: vi.fn(async (): Promise<"saved" | "failed"> => "saved"),
  recordTrustpilotShown: vi.fn(async () => {}),
}));

vi.mock("@/app/actions/trustpilot", () => ({
  recordTrustpilotClick,
  recordTrustpilotShown,
}));

import { TRUSTPILOT_REVIEW_URL } from "@/lib/trustpilotInvitation";
import { TrustpilotInvitationProvider } from "../trustpilotInvitation";
import { TrustpilotInvitation } from "./TrustpilotInvitation";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  recordTrustpilotClick.mockReset();
  recordTrustpilotShown.mockReset();
  recordTrustpilotClick.mockResolvedValue("saved");
  recordTrustpilotShown.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function renderInvitation(show: boolean, recordShown: boolean) {
  return act(async () => {
    root.render(
      <TrustpilotInvitationProvider show={show} recordShown={recordShown}>
        <TrustpilotInvitation />
        <TrustpilotInvitation />
      </TrustpilotInvitationProvider>,
    );
  });
}

describe("TrustpilotInvitation", () => {
  it("does not show or record a display when the link was already opened", async () => {
    await renderInvitation(false, false);
    expect(container.textContent).not.toContain("Ihre Meinung ist uns wichtig!");
    expect(recordTrustpilotShown).not.toHaveBeenCalled();
  });

  it("records the display once and opens Trustpilot in a new tab", async () => {
    await renderInvitation(true, true);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe(TRUSTPILOT_REVIEW_URL);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(recordTrustpilotShown).toHaveBeenCalledTimes(1);
  });

  it("hides every invitation after the click is stored", async () => {
    await renderInvitation(true, false);
    const link = container.querySelector("a");
    await act(async () => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(recordTrustpilotClick).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Ihre Meinung ist uns wichtig!");

    await act(async () => {
      root.render(
        <TrustpilotInvitationProvider show recordShown={false}>
          <TrustpilotInvitation />
        </TrustpilotInvitationProvider>,
      );
    });
    expect(container.textContent).not.toContain("Ihre Meinung ist uns wichtig!");
  });

  it("keeps the invitation when the click is not stored", async () => {
    recordTrustpilotClick.mockResolvedValue("failed");
    await renderInvitation(true, false);
    const link = container.querySelector("a");
    await act(async () => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Ihre Meinung ist uns wichtig!");
    expect(container.textContent).toContain("Der Klick konnte nicht gespeichert werden.");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(TRUSTPILOT_REVIEW_URL);
  });
});
