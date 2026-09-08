import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HeaderAccount } from "./HeaderAccount";

const ACCOUNT = "https://pvnavigator.de/konto";
const SIGN_OUT = "https://pvnavigator.de/auth/sign-out";

describe("HeaderAccount", () => {
  it("renders Mein Konto, email, and Hub Abmelden for an authenticated user", () => {
    const html = renderToStaticMarkup(
      <HeaderAccount
        authenticated
        userEmail="user@example.de"
        loginHref="https://pvnavigator.de/anmelden?next=speicher-calculate"
        signupHref="https://pvnavigator.de/konto-erstellen"
        accountHref={ACCOUNT}
        signOutHref={SIGN_OUT}
      />,
    );

    expect(html).toContain("Mein Konto");
    expect(html).toContain(`href="${ACCOUNT}"`);
    expect(html).toContain("user@example.de");
    expect(html).toContain(`action="${SIGN_OUT}"`);
    expect(html).toContain('method="post"');
    expect(html).toContain("Abmelden");
    expect(html).not.toContain("Anmelden");
  });

  it("does not show account or logout when signed out", () => {
    const html = renderToStaticMarkup(
      <HeaderAccount
        authenticated={false}
        userEmail={null}
        loginHref="https://pvnavigator.de/anmelden?next=speicher-calculate"
        signupHref="https://pvnavigator.de/konto-erstellen"
        accountHref={ACCOUNT}
        signOutHref={SIGN_OUT}
      />,
    );

    expect(html).toContain("Anmelden");
    expect(html).toContain("Konto erstellen");
    expect(html).not.toContain("Mein Konto");
    expect(html).not.toContain("Abmelden");
    expect(html).not.toContain(SIGN_OUT);
  });
});
