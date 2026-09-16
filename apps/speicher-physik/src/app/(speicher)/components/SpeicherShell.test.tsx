import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const usePathname = vi.fn(() => "/calculate");

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
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

const shellProps = {
  authenticated: true,
  userEmail: "user@example.de",
  loginHref: "https://pvnavigator.de/anmelden",
  signupHref: "https://pvnavigator.de/konto-erstellen",
  accountHref: "https://pvnavigator.de/konto",
  signOutHref: "https://pvnavigator.de/auth/sign-out",
} as const;

function renderShell() {
  return renderToStaticMarkup(
    <SpeicherShell {...shellProps}>
      <div>report</div>
    </SpeicherShell>,
  );
}

describe("SpeicherShell overflow chain", () => {
  it("lets main shrink and clips residual page overflow without a page scroller", () => {
    usePathname.mockReturnValue("/calculate");
    const html = renderShell();

    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0 flex-1");
    expect(html).not.toContain("overflow-x-hidden");
    expect(html).toContain("Mein Konto");
    expect(html).toContain("href=\"https://pvnavigator.de/konto\"");
    expect(html).toContain("PVNAVIGATOR_");
    expect(html).toContain("SPEICHERGRENZE");
    expect(html).toContain(
      "mx-auto flex min-h-screen w-full min-w-0 max-w-frame flex-col px-4 sm:px-6 lg:px-8"
    );
    expect(html).toContain(
      "flex min-h-0 min-w-0 flex-1 flex-col border border-line-strong bg-canvas"
    );

    const headerHtml = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>")
    );
    expect(headerHtml).toContain("PVNAVIGATOR_");
    expect(headerHtml).toContain("Mein Konto");
    expect(headerHtml).toContain("border-b border-line");
    expect(headerHtml).toContain("bg-canvas");
    expect(headerHtml).not.toContain("border-line-strong");
    expect(headerHtml).not.toContain("border-b border-line bg-surface");
    expect(headerHtml).not.toContain("h-8 w-8");
    expect(headerHtml).not.toContain("Bitte Daten eingeben");
    expect(headerHtml).not.toContain("Berechnet");
    expect(headerHtml).not.toContain("Methodik");
    expect(headerHtml).not.toContain("/methodik");
    expect(headerHtml).not.toContain("Abmelden");
    expect(headerHtml).not.toContain("user@example.de");
    expect(headerHtml).not.toContain("Speicher berechnen");
    expect(headerHtml).not.toContain("aria-haspopup");

    const footerHtml = html.slice(html.indexOf("<footer"));
    expect(footerHtml).toContain("href=\"/methodik\"");
    expect(footerHtml).toContain("Methodik");
    expect(footerHtml).toContain("border-t border-line bg-canvas");
    expect(footerHtml).not.toContain("border-line-strong");
  });

  it("keeps email, sign-out, and the calculator link off /calculate", () => {
    usePathname.mockReturnValue("/");
    const html = renderShell();
    const headerHtml = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>")
    );

    expect(headerHtml).toContain("Mein Konto");
    expect(headerHtml).toContain("user@example.de");
    expect(headerHtml).toContain("Abmelden");
    expect(headerHtml).toContain("Speicher berechnen");
    expect(headerHtml).toContain("max-md:hidden");
    expect(headerHtml).not.toContain("Methodik");
    expect(html).not.toContain("border border-line-strong");
  });
});
