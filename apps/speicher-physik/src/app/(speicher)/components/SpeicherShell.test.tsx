import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/calculate",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children?: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { SpeicherShell } from "./SpeicherShell";

describe("SpeicherShell overflow chain", () => {
  it("lets main shrink and clips residual page overflow without a page scroller", () => {
    const html = renderToStaticMarkup(
      <SpeicherShell
        authenticated
        userEmail="user@example.de"
        loginHref="https://pvnavigator.de/anmelden"
        signupHref="https://pvnavigator.de/konto-erstellen"
        accountHref="https://pvnavigator.de/konto"
        signOutHref="https://pvnavigator.de/auth/sign-out"
      >
        <div>report</div>
      </SpeicherShell>,
    );

    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0 flex-1");
    expect(html).toContain("max-md:hidden");
    expect(html).not.toContain("overflow-x-hidden");
    expect(html).toContain("Mein Konto");
    expect(html).toContain("Abmelden");
    expect(html).toContain("user@example.de");
    expect(html).toContain("hidden");
    expect(html).toContain("lg:inline");
  });
});
