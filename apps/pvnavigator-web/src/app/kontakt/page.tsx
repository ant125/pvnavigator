import type { Metadata } from "next";

import { InfoBackButton } from "@/components/info/InfoBackButton";
import { InfoPageHeader } from "@/components/info/InfoPageHeader";

export const metadata: Metadata = {
  title: "Kontakt | PVNAVIGATOR_",
  description: "Bei Fragen oder Anregungen erreichst du uns per E-Mail.",
};

export default function KontaktPage() {
  return (
    <div className="hub-workspace">
      <InfoPageHeader
        title="Kontakt"
        subtitle="Bei Fragen oder Anregungen erreichst du uns per E-Mail."
      />
      <div className="hub-account-details">
        <section className="hub-panel hub-account" aria-labelledby="email-heading">
          <h2 id="email-heading" className="hub-kicker">
            E-Mail
          </h2>
          <p className="hub-email">
            <a className="hub-quiet-link inline-flex min-h-11 items-center" href="mailto:info@pvnavigator.de">
              info@pvnavigator.de
            </a>
          </p>
        </section>
        <section className="hub-panel hub-account" aria-labelledby="antwortzeit-heading">
          <h2 id="antwortzeit-heading" className="hub-kicker">
            Antwortzeit
          </h2>
          <p className="hub-subtitle">In der Regel innerhalb von 1–2 Werktagen.</p>
        </section>
      </div>
      <InfoBackButton />
    </div>
  );
}
