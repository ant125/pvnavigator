import Link from "next/link";
import { getVerifiedResult } from "../calculate/verifiedResultStore.server";
import { MethodologyAccordion } from "./components/MethodologyAccordion";

const PLACEHOLDER = "—";

export default function SpeicherResultPage() {
  const verifiedResult = getVerifiedResult();
  const selfConsumption =
    verifiedResult?.energy.year.selfConsumptionWithoutStorage;

  return (
    <div className="py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-16">
        <SummarySection selfConsumption={selfConsumption} />
        <CalculationBasisSection />
        <MethodologyAccordion />
        <BatteryAssumptionsSection />
        <AnnualComparisonSection />
        <LifetimeEconomicsSection />
        <RecommendationSection />
        <FAQSection />
        <NextStepsSection />
      </div>
    </div>
  );
}

function SummarySection({
  selfConsumption,
}: {
  selfConsumption?: number | null;
}) {
  return (
    <section>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-6">
        Ergebnis für Ihr Haus – auf einen Blick
      </h1>

      <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/50 mb-6">
        <div className="space-y-3">
          <p className="text-lg text-slate-200 leading-relaxed">
            Ein Stromspeicher ist für Ihr Haus grundsätzlich sinnvoll.
          </p>
          <p className="text-xl sm:text-2xl font-semibold text-slate-100">
            Die beste Balance aus Nutzen und Wirtschaftlichkeit bietet ein
            Speicher mit ca.{" "}
            <span className="text-amber-400">{PLACEHOLDER}</span>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <p className="text-xs text-slate-400 mb-1">
            Eigenverbrauch ohne Speicher (jährlich)
          </p>
          <p className="text-2xl font-bold text-slate-300">
            {typeof selfConsumption === "number"
              ? `${selfConsumption.toFixed(0)} kWh`
              : PLACEHOLDER}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <p className="text-xs text-slate-400 mb-1">
            Eigenverbrauch mit Speicher
          </p>
          <p className="text-2xl font-bold text-emerald-400">{PLACEHOLDER}</p>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
        <p className="text-sm text-slate-400 leading-relaxed">
          Unsere Empfehlung basiert auf Zahlen – nicht auf Verkaufsinteressen.
          Alle Annahmen und Berechnungen sind transparent dargestellt und können
          jederzeit angepasst werden.
        </p>
      </div>
    </section>
  );
}

function CalculationBasisSection() {
  const inputData = [
    { label: "PV-Anlage", value: PLACEHOLDER },
    { label: "Standort", value: PLACEHOLDER },
    { label: "Dachausrichtung / Neigung", value: PLACEHOLDER },
    { label: "Jährlicher Stromverbrauch", value: PLACEHOLDER },
  ];

  const pvModelData = [
    { label: "Erwartete Jahreserzeugung", value: PLACEHOLDER },
    { label: "Modell", value: PLACEHOLDER },
    { label: "Hinweis", value: "Vereinfachtes Ertragsmodell (keine Live-Daten)" },
  ];

  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6">
        Grundlage Ihrer Berechnung
      </h2>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Ihre Eingaben
          </h3>
          <dl className="space-y-3">
            {inputData.map((item, i) => (
              <div key={i} className="flex justify-between">
                <dt className="text-slate-400 text-sm">{item.label}</dt>
                <dd className="text-slate-100 text-sm font-medium">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            PV-Erzeugung (Modell)
          </h3>
          <dl className="space-y-3">
            {pvModelData.map((item, i) => (
              <div key={i} className="flex justify-between gap-4">
                <dt className="text-slate-400 text-sm">{item.label}</dt>
                <dd className="text-slate-100 text-sm font-medium text-right">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <p className="text-sm text-slate-500 leading-relaxed">
        Die PV-Erzeugung wird stündlich über ein gesamtes Jahr modelliert, um
        Erzeugung und Verbrauch zeitlich vergleichen zu können.
      </p>
    </section>
  );
}

function BatteryAssumptionsSection() {
  const assumptions = [
    { label: "Nutzbare Kapazität", value: "je nach Szenario" },
    { label: "Lade-/Entladewirkungsgrad", value: PLACEHOLDER },
    { label: "Durchschnittliche Zyklen pro Jahr", value: PLACEHOLDER },
    { label: "Angenommene Lebensdauer", value: PLACEHOLDER },
    { label: "Gesamte Zyklen über Lebensdauer", value: PLACEHOLDER },
  ];

  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6">
        Annahmen zum Stromspeicher
      </h2>

      <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50 mb-6">
        <dl className="grid sm:grid-cols-2 gap-4">
          {assumptions.map((item, i) => (
            <div key={i} className="flex flex-col">
              <dt className="text-slate-400 text-sm mb-1">{item.label}</dt>
              <dd className="text-slate-100 font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="text-sm text-slate-500 leading-relaxed">
        Die Wirtschaftlichkeit eines Speichers ergibt sich nicht nur aus der
        Kapazität, sondern aus der tatsächlichen Nutzung über seine Lebensdauer.
      </p>
    </section>
  );
}

function AnnualComparisonSection() {
  const rows = [
    { label: "Ohne Speicher" },
    { label: "Speicher Variante A" },
    { label: "Speicher Variante B" },
    { label: "Speicher Variante C" },
  ];

  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6">
        Vergleich der Szenarien (jährlich)
      </h2>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-slate-400 font-medium">
                Szenario
              </th>
              <th className="text-right py-3 px-4 text-slate-400 font-medium">
                Eigenverbrauch
              </th>
              <th className="text-right py-3 px-4 text-slate-400 font-medium">
                Netzbezug
              </th>
              <th className="text-right py-3 px-4 text-slate-400 font-medium">
                Einspeisung
              </th>
              <th className="text-right py-3 px-4 text-slate-400 font-medium">
                Ersparnis/Jahr
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-800">
                <td className="py-4 px-4 text-slate-200">{row.label}</td>
                <td className="text-right py-4 px-4 text-slate-200">
                  {PLACEHOLDER}
                </td>
                <td className="text-right py-4 px-4 text-slate-200">
                  {PLACEHOLDER}
                </td>
                <td className="text-right py-4 px-4 text-slate-200">
                  {PLACEHOLDER}
                </td>
                <td className="text-right py-4 px-4 text-slate-400">
                  {PLACEHOLDER}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Alle Ersparnisse beziehen sich auf ein Jahr und sind relativ zum
        Szenario „Ohne Speicher" angegeben.
      </p>
    </section>
  );
}

function LifetimeEconomicsSection() {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-2">
        Wirtschaftlichkeit über die Lebensdauer des Speichers
      </h2>
      <p className="text-slate-400 mb-6">
        Betrachtungszeitraum: {PLACEHOLDER}
      </p>

      <div className="p-6 rounded-xl bg-slate-800/40 border border-slate-700/50 mb-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Vergleich: zwei Speichergrößen
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 pr-4 text-slate-400 font-medium"></th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">
                  Speicher {PLACEHOLDER}
                </th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">
                  Speicher {PLACEHOLDER}
                </th>
                <th className="text-right py-3 pl-4 text-slate-400 font-medium">
                  Differenz
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800">
                <td className="py-3 pr-4 text-slate-300">
                  Investitionskosten Speicher
                </td>
                <td className="text-right py-3 px-4 text-slate-100">
                  {PLACEHOLDER}
                </td>
                <td className="text-right py-3 px-4 text-slate-100">
                  {PLACEHOLDER}
                </td>
                <td className="text-right py-3 pl-4 text-rose-400">
                  {PLACEHOLDER}
                </td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-3 pr-4 text-slate-300">
                  Jährliche Ersparnis
                </td>
                <td className="text-right py-3 px-4 text-slate-100">
                  {PLACEHOLDER}
                </td>
                <td className="text-right py-3 px-4 text-slate-100">
                  {PLACEHOLDER}
                </td>
                <td className="text-right py-3 pl-4 text-emerald-400">
                  {PLACEHOLDER}
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-slate-200 font-medium">
                  Ersparnis über {PLACEHOLDER} Jahre
                </td>
                <td className="text-right py-3 px-4 text-slate-100 font-medium">
                  {PLACEHOLDER}
                </td>
                <td className="text-right py-3 px-4 text-slate-100 font-medium">
                  {PLACEHOLDER}
                </td>
                <td className="text-right py-3 pl-4 text-emerald-400 font-medium">
                  {PLACEHOLDER}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Wirtschaftliche Bewertung
        </h3>
        <div className="space-y-3 text-slate-300 leading-relaxed">
          <p>
            Der größere Speicher erfordert eine Mehrinvestition von{" "}
            <span className="text-slate-100 font-medium">{PLACEHOLDER}</span>,
            liefert über die angenommene Lebensdauer jedoch nur ca.{" "}
            <span className="text-slate-100 font-medium">{PLACEHOLDER}</span>{" "}
            zusätzliche Ersparnis.
          </p>
          <p className="text-slate-100 font-medium">
            Aus wirtschaftlicher Sicht ist der kleinere Speicher die sinnvollere
            Wahl.
          </p>
        </div>
      </div>
    </section>
  );
}

function RecommendationSection() {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6">
        Unsere ehrliche Empfehlung
      </h2>

      <div className="p-6 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <div className="space-y-4 text-slate-200 leading-relaxed">
          <p>
            Für Ihr Haus ist ein Speicher mit ca.{" "}
            <span className="text-amber-400 font-semibold">{PLACEHOLDER}</span>{" "}
            sinnvoll, da er den größten Teil des abendlichen Verbrauchs abdeckt,
            ohne unverhältnismäßige Mehrkosten zu verursachen.
          </p>
          <p>
            Größere Speicher erhöhen den Eigenverbrauch nur noch geringfügig und
            sind aus wirtschaftlicher Sicht nicht effizient.
          </p>
          <div className="pt-2 border-t border-amber-500/10">
            <p className="text-sm text-slate-400">
              Diese Empfehlung basiert auf den Berechnungen in den obigen
              Abschnitten. Bei anderen Annahmen kann sich das Ergebnis ändern.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const questions = [
    "Lohnt sich ein Speicher überhaupt?",
    "Welche Größe passt zu Ihrem Haus?",
    "Ist ein vorliegendes Angebot sinnvoll, zu groß oder zu teuer?",
  ];

  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6">
        Fragen, die diese Auswertung beantwortet
      </h2>

      <div className="space-y-4 mb-6">
        {questions.map((question, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50"
          >
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
              <span className="text-lg">?</span>
            </div>
            <span className="text-slate-200">{question}</span>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
        <p className="text-sm text-slate-400 leading-relaxed">
          Die Antworten basieren ausschließlich auf den oben dargestellten
          Berechnungsergebnissen. Es werden keine Annahmen ergänzt, die nicht
          explizit dokumentiert sind.
        </p>
      </div>
    </section>
  );
}

function NextStepsSection() {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6">
        Wie geht es weiter?
      </h2>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <button
          disabled
          className="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 opacity-60 cursor-not-allowed"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <span>PDF-Bericht herunterladen</span>
          <span className="text-xs text-slate-500">(bald verfügbar)</span>
        </button>

        <Link
          href="/calculate"
          className="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          <span>Eingaben anpassen & neu berechnen</span>
        </Link>
      </div>

      <p className="text-sm text-slate-500 text-center">
        Alle Annahmen und Ergebnisse bleiben nachvollziehbar und vergleichbar.
      </p>
    </section>
  );
}
