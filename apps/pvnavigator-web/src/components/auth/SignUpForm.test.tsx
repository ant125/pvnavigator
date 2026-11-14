import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SignUpForm } from "./SignUpForm";

describe("signup form", () => {
  it("asks for a private name and offers Unternehmen", () => {
    const html = renderToStaticMarkup(<SignUpForm />);
    expect(html).toContain("Privatperson");
    expect(html).toContain("Unternehmen");
    expect(html).toContain("Vorname");
    expect(html).toContain("Nachname");
    expect(html).toContain('name="account_kind"');
    expect(html).not.toContain("Firmenname");
  });
});
