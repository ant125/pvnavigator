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
import { getHubOrigin } from "@pv-auth/session";

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
      "mx-auto flex min-h-screen w-full min-w-0 max-w-frame flex-col px-4 py-2 sm:px-6 sm:pt-3 sm:pb-4 lg:px-8"
    );
    expect(html).toContain(
      "flex min-h-0 min-w-0 flex-1 flex-col border border-line-strong bg-canvas"
    );

    const hubOrigin = getHubOrigin();
    const headerHtml = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>")
    );
    expect(headerHtml).toContain("PVNAVIGATOR_");
    expect(headerHtml).toContain('href="https://pvnavigator.de"');
    expect(headerHtml).toContain(">PVNAVIGATOR_</a>");
    expect(headerHtml).toContain('href="/"');
    expect(headerHtml).toContain(">SPEICHERGRENZE</a>");
    expect(headerHtml).toContain("hover:text-accent");
    expect(headerHtml).toContain("hover:bg-accent/[0.06]");
    expect(headerHtml).toContain("duration-150");
    expect(headerHtml).toContain("hover:no-underline");
    expect(headerHtml).toContain("focus-visible:outline-focus");
    expect(headerHtml).not.toContain("hover:underline hover:underline-offset-2");
    expect(headerHtml).toContain('aria-hidden="true"');
    expect(headerHtml).not.toContain('aria-label="PVNavigator SpeicherGrenze"');
    expect(headerHtml).toContain("Mein Konto");
    expect(headerHtml).toContain("border-b border-line");
    expect(headerHtml).toContain("min-h-sg-calculate-header");
    expect(headerHtml).toContain("tracking-[0.06em]");
    expect(headerHtml).toContain("sm:tracking-[0.16em]");
    expect(headerHtml).toContain("sm:gap-3");
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
    expect(footerHtml).toContain("PVNAVIGATOR_");
    expect(footerHtml).toContain('href="https://pvnavigator.de"');
    expect(footerHtml).toContain(">PVNAVIGATOR_</a>");
    expect(footerHtml).toContain("hover:text-accent");
    expect(footerHtml).toContain("hover:bg-accent/[0.06]");
    expect(footerHtml).toContain("duration-150");
    expect(footerHtml).toContain("hover:no-underline");
    expect(footerHtml).not.toContain('href="/"');
    expect(footerHtml).toContain("Kontakt");
    expect(footerHtml).toContain("Impressum");
    expect(footerHtml).toContain("Datenschutz");
    expect(footerHtml).toContain(`href="${hubOrigin}/kontakt"`);
    expect(footerHtml).toContain(`href="${hubOrigin}/impressum"`);
    expect(footerHtml).toContain(`href="${hubOrigin}/datenschutz"`);
    expect(footerHtml).toContain("border-t border-line bg-canvas");
    expect(footerHtml).toContain("px-layout-gap py-2.5");
    expect(footerHtml).not.toContain("border-line-strong");
    expect(footerHtml).not.toContain("SpeicherGrenze");
    expect(footerHtml).not.toContain("by PVNavigator");
    expect(footerHtml).not.toContain("15-Minuten-Zeitschritte");
    expect(footerHtml).not.toContain("15 Wetterjahre");
    expect(footerHtml).not.toContain("Validierung mit 27 Referenzhaushalten");
    expect(footerHtml).not.toContain("Unterlagen");
    expect(footerHtml).not.toContain("Methodik");
    expect(footerHtml).not.toContain("href=\"/methodik\"");
    expect(footerHtml).not.toContain("Referenz");
  });

  it("keeps the signed-out calculate wordmark on one line beside both account links", () => {
    usePathname.mockReturnValue("/calculate");
    const html = renderToStaticMarkup(
      <SpeicherShell {...shellProps} authenticated={false} userEmail={null}>
        <div>report</div>
      </SpeicherShell>,
    );
    const headerHtml = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>"),
    );

    expect(headerHtml).toContain("Anmelden");
    expect(headerHtml).toContain("Konto erstellen");
    expect(headerHtml).toContain("text-[9px]");
    expect(headerHtml).toContain("tracking-normal");
    expect(headerHtml).toContain("text-xs");
    expect(headerHtml).toContain("min-h-11");
    expect(headerHtml).toContain("min-h-sg-calculate-header");
    expect(headerHtml).not.toContain("flex-wrap");
  });

  it("keeps email, sign-out, and the calculator link off /calculate", () => {
    usePathname.mockReturnValue("/");
    const html = renderShell();
    const headerHtml = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>")
    );
    const footerHtml = html.slice(html.indexOf("<footer"));

    expect(headerHtml).toContain("Mein Konto");
    expect(headerHtml).toContain('href="https://pvnavigator.de"');
    expect(headerHtml).toContain(">PVNAVIGATOR_</a>");
    expect(headerHtml).toContain(">SPEICHERGRENZE</a>");
    expect(headerHtml).toContain("user@example.de");
    expect(headerHtml).toContain("Abmelden");
    expect(headerHtml).toContain("Speicher berechnen");
    expect(headerHtml).toContain("max-md:hidden");
    expect(headerHtml).not.toContain("min-h-sg-calculate-header");
    expect(headerHtml).not.toContain("Methodik");
    expect(html).not.toContain("border border-line-strong");
    expect(footerHtml).toContain("SpeicherGrenze");
    expect(footerHtml).toContain("Unterlagen");
    expect(footerHtml).toContain('href="/methodik"');
    expect(footerHtml).toContain("Methodik");
    expect(footerHtml).toContain("Referenz");
  });
});
