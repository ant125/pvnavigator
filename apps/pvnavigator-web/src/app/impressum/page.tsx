import Link from "next/link";

export default function ImpressumPage() {
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
          <span className="text-[#64748B]">Impressum</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mb-6">Impressum</h1>

        <div className="mb-8 space-y-8 text-[#64748B]">
          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Anbieter</h2>
            <address className="not-italic leading-relaxed">
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
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Kontakt</h2>
            <p className="leading-relaxed">
              E-Mail:{" "}
              <a
                href="mailto:info@pvnavigator.de"
                className="text-[#64748B] transition-colors hover:text-[#0F172A]"
              >
                info@pvnavigator.de
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Umsatzsteuer</h2>
            <p className="leading-relaxed">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">
              Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
            </h2>
            <address className="not-italic leading-relaxed">
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
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Über PVNavigator</h2>
            <p className="leading-relaxed">
              „PVNavigator ist eine unabhängige Plattform für technische und wirtschaftliche Analysen im Bereich
              Photovoltaik, Speicher und Energieverbrauch.“
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">Haftungshinweis</h2>
            <ul className="list-disc space-y-1 pl-5 leading-relaxed">
              <li>Die Inhalte dieser Website werden mit Sorgfalt erarbeitet.</li>
              <li>Eine Gewähr für Vollständigkeit, Richtigkeit und ständige Aktualität besteht nicht.</li>
              <li>
                Die Angebote von PVNavigator ersetzen keine verbindliche technische, steuerliche oder finanzielle
                Beratung.
              </li>
            </ul>
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
