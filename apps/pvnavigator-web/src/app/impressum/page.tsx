import { InfoBackButton } from "@/components/info/InfoBackButton";
import { InfoPageHeader } from "@/components/info/InfoPageHeader";

export default function ImpressumPage() {
  return (
    <div className="hub-workspace">
      <InfoPageHeader title="Impressum" />
      <article className="hub-panel">
        <div className="hub-document">
          <section>
            <h2>Anbieter</h2>
            <address>
              Anton Rudenko
              <br />
              Einzelunternehmer
              <br />
              <br />
              Branderstraße 44
              <br />
              86154 Augsburg
              <br />
              Deutschland
            </address>
          </section>

          <section>
            <h2>Kontakt</h2>
            <p>
              E-Mail:{" "}
              <a href="mailto:info@pvnavigator.de">info@pvnavigator.de</a>
            </p>
          </section>

          <section>
            <h2>Umsatzsteuer</h2>
            <p>
              Auf die Kleinunternehmerregelung wurde verzichtet. Die Umsatzsteuer wird anhand der Rechnungsadresse
              berechnet und auf der Rechnung ausgewiesen. Bei grenzüberschreitenden Leistungen an Unternehmen mit
              gültiger USt-IdNr. kann die Steuerschuldnerschaft beim Leistungsempfänger liegen.
            </p>
          </section>

          <section>
            <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <address>
              Anton Rudenko
              <br />
              Branderstraße 44
              <br />
              86154 Augsburg
              <br />
              Deutschland
            </address>
          </section>

          <section>
            <h2>Über PVNAVIGATOR_</h2>
            <p>
              „PVNAVIGATOR_ ist eine unabhängige Plattform für technische und wirtschaftliche Analysen im Bereich
              Photovoltaik, Speicher und Energieverbrauch.“
            </p>
          </section>

          <section>
            <h2>Haftungshinweis</h2>
            <ul>
              <li>Die Inhalte dieser Website werden mit Sorgfalt erarbeitet.</li>
              <li>Eine Gewähr für Vollständigkeit, Richtigkeit und ständige Aktualität besteht nicht.</li>
              <li>
                Die Angebote von PVNAVIGATOR_ ersetzen keine verbindliche technische, steuerliche oder finanzielle
                Beratung.
              </li>
            </ul>
          </section>
        </div>
      </article>
      <InfoBackButton />
    </div>
  );
}
