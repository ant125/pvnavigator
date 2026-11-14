import { InfoBackButton } from "@/components/info/InfoBackButton";
import { InfoPageHeader } from "@/components/info/InfoPageHeader";

export default function DatenschutzPage() {
  return (
    <div className="hub-workspace">
      <InfoPageHeader title="Datenschutz" />
      <article className="hub-panel">
        <div className="hub-document">
          <section>
            <h2>Einleitung</h2>
            <p>
              Bei PVNAVIGATOR_ verarbeiten wir personenbezogene Daten nur, soweit das für unsere Photovoltaik- und
              Energieanalyseleistungen nötig ist. Die folgenden Angaben beschreiben den wesentlichen Umgang mit Ihren
              Daten in einer für ein frühes SaaS-Angebot angemessen kompakten Form.
            </p>
          </section>

          <section>
            <h2>Verantwortlicher</h2>
            <address>
              Anton Rudenko
              <br />
              Branderstraße 44
              <br />
              86154 Augsburg
              <br />
              E-Mail: <a href="mailto:info@pvnavigator.de">info@pvnavigator.de</a>
            </address>
          </section>

          <section>
            <h2>Verarbeitete Daten</h2>
            <p>Je nach Nutzung der Plattform können insbesondere folgende Datenkategorien vorkommen:</p>
            <ul>
              <li>E-Mail-Adresse</li>
              <li>Adressdaten</li>
              <li>Verbrauchsdaten</li>
              <li>Angaben zu Photovoltaik und Wärmepumpe</li>
              <li>technische Nutzungsdaten (z.&nbsp;B. Log- und Geräteinformationen, soweit erforderlich)</li>
            </ul>
          </section>

          <section>
            <h2>Zweck der Verarbeitung</h2>
            <p>Die Daten verwenden wir insbesondere für:</p>
            <ul>
              <li>Berechnung technischer Analysen</li>
              <li>Wirtschaftlichkeitsberechnungen</li>
              <li>Betrieb und Sicherheit Ihres Nutzerkontos</li>
              <li>Verbesserung, Stabilität und Weiterentwicklung der Plattform</li>
            </ul>
          </section>

          <section>
            <h2>Eingesetzte Dienste</h2>
            <p>
              Für Hosting und Auslieferung setzen wir <strong>Vercel</strong> ein. Authentifizierung, Datenbank und
              verwandte Funktionen können über <strong>Supabase</strong> bereitgestellt werden. Für Karten- und
              Standortbezüge können <strong>OpenStreetMap</strong>-Inhalte genutzt werden; für solare Einstrahlungs- und
              PV-Standortdaten greifen wir unter anderem auf <strong>PVGIS</strong> zurück. Details ergeben sich aus der
              jeweiligen konkreten Funktion.
            </p>
          </section>

          <section>
            <h2>Speicherung</h2>
            <p>
              Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke oder gesetzliche
              Aufbewahrungsfristen erforderlich ist. Sind Daten nicht mehr nötig, werden sie gelöscht oder anonymisiert,
              sobald dies technisch und organisatorisch möglich ist.
            </p>
          </section>

          <section>
            <h2>Rechte der Nutzer</h2>
            <p>
              Sie haben nach Maßgabe der DSGVO unter anderem Recht auf <strong>Auskunft</strong>,{" "}
              <strong>Berichtigung</strong> und <strong>Löschung</strong> über Sie betreffender Daten. Zur Ausübung
              Ihrer Rechte erreichen Sie uns unter der unten genannten E-Mail-Adresse.
            </p>
          </section>

          <section>
            <h2>Kontakt</h2>
            <p>
              Fragen zum Datenschutz richten Sie bitte an: <a href="mailto:info@pvnavigator.de">info@pvnavigator.de</a>
            </p>
          </section>
        </div>
      </article>
      <InfoBackButton />
    </div>
  );
}
