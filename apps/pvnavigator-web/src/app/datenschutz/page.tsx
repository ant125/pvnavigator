import Link from "next/link";

export default function DatenschutzPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <nav className="mb-3 text-[13px] leading-relaxed text-[#94a3b8]" aria-label="Brotkrumenpfad">
          <Link href="/" className="transition-colors hover:text-[#64748B]">
            Startseite
          </Link>
          <span className="mx-1.5 text-[#CBD5E1]" aria-hidden>
            /
          </span>
          <span className="text-[#64748B]">Datenschutz</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mb-6">Datenschutz</h1>

        <div className="mb-8 space-y-8 text-[#64748B]">
          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Einleitung</h2>
            <p className="leading-relaxed">
              Bei PVNavigator verarbeiten wir personenbezogene Daten nur, soweit das für unsere Photovoltaik- und
              Energieanalyseleistungen nötig ist. Die folgenden Angaben beschreiben den wesentlichen Umgang mit Ihren
              Daten in einer für ein frühes SaaS-Angebot angemessen kompakten Form.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Verantwortlicher</h2>
            <address className="not-italic leading-relaxed">
              Anton Rudenko
              <br />
              Branderstraße 44
              <br />
              86154 Augsburg
              <br />
              E-Mail:{" "}
              <a
                href="mailto:info@pvnavigator.de"
                className="text-[#64748B] transition-colors hover:text-[#0F172A]"
              >
                info@pvnavigator.de
              </a>
            </address>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Verarbeitete Daten</h2>
            <p className="mb-3 leading-relaxed">
              Je nach Nutzung der Plattform können insbesondere folgende Datenkategorien vorkommen:
            </p>
            <ul className="list-disc space-y-1 pl-5 leading-relaxed">
              <li>E-Mail-Adresse</li>
              <li>Adressdaten</li>
              <li>Verbrauchsdaten</li>
              <li>Angaben zu Photovoltaik und Wärmepumpe</li>
              <li>technische Nutzungsdaten (z.&nbsp;B. Log- und Geräteinformationen, soweit erforderlich)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Zweck der Verarbeitung</h2>
            <p className="mb-3 leading-relaxed">Die Daten verwenden wir insbesondere für:</p>
            <ul className="list-disc space-y-1 pl-5 leading-relaxed">
              <li>Berechnung technischer Analysen</li>
              <li>Wirtschaftlichkeitsberechnungen</li>
              <li>Betrieb und Sicherheit Ihres Nutzerkontos</li>
              <li>Verbesserung, Stabilität und Weiterentwicklung der Plattform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Eingesetzte Dienste</h2>
            <p className="leading-relaxed">
              Für Hosting und Auslieferung setzen wir <strong className="font-medium text-[#475569]">Vercel</strong>{" "}
              ein. Authentifizierung, Datenbank und verwandte Funktionen können über{" "}
              <strong className="font-medium text-[#475569]">Supabase</strong> bereitgestellt werden. Für
              Karten- und Standortbezüge können{" "}
              <strong className="font-medium text-[#475569]">OpenStreetMap</strong>-Inhalte genutzt werden; für
              solare Einstrahlungs- und PV-Standortdaten greifen wir unter anderem auf{" "}
              <strong className="font-medium text-[#475569]">PVGIS</strong> zurück. Details ergeben sich aus der
              jeweiligen konkreten Funktion.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Speicherung</h2>
            <p className="leading-relaxed">
              Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke oder gesetzliche
              Aufbewahrungsfristen erforderlich ist. Sind Daten nicht mehr nötig, werden sie gelöscht oder anonymisiert,
              sobald dies technisch und organisatorisch möglich ist.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Rechte der Nutzer</h2>
            <p className="mb-3 leading-relaxed">
              Sie haben nach Maßgabe der DSGVO unter anderem Recht auf{" "}
              <strong className="font-medium text-[#475569]">Auskunft</strong>,{" "}
              <strong className="font-medium text-[#475569]">Berichtigung</strong> und{" "}
              <strong className="font-medium text-[#475569]">Löschung</strong> über Sie betreffender Daten. Zur
              Ausübung Ihrer Rechte erreichen Sie uns unter der unten genannten E-Mail-Adresse.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Kontakt</h2>
            <p className="leading-relaxed">
              Fragen zum Datenschutz richten Sie bitte an:{" "}
              <a
                href="mailto:info@pvnavigator.de"
                className="text-[#64748B] transition-colors hover:text-[#0F172A]"
              >
                info@pvnavigator.de
              </a>
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="inline-flex px-4 py-2 rounded-full bg-[#F59E0B] hover:bg-[#d97706] text-white font-semibold text-sm transition-colors"
        >
          ← Zurück
        </Link>
      </div>
    </div>
  );
}
