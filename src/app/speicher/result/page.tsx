"use client";

import Link from "next/link";

/**
 * Speicher Result Page
 * 
 * Route: /speicher/result
 * 
 * This is the core product page – designed as a small investment report.
 * Every recommendation is justified with numbers.
 * 
 * Key principle: A Speicher decision is an investment decision.
 * 
 * Tone: calm, technical, transparent, independent
 * No marketing, no urgency, no persuasion – only clarity.
 */

// =============================================================================
// MOCK DATA (will be replaced with real calculations)
// =============================================================================

const MOCK_INPUT = {
  pvSizeKwp: 9.8,
  location: "München",
  roofOrientation: "Süd",
  roofTilt: 30,
  annualConsumptionKwh: 4500,
};

const MOCK_PV_MODEL = {
  expectedAnnualGenerationKwh: 9300,
  simulationHours: 8760,
};

const MOCK_BATTERY_ASSUMPTIONS = {
  efficiency: 0.92,
  cyclesPerYear: 230,
  lifetimeYears: 10,
  totalLifetimeCycles: 2300,
};

const MOCK_SCENARIOS = [
  {
    id: "none",
    label: "Ohne Speicher",
    capacityKwh: 0,
    selfConsumptionPercent: 32,
    gridPurchaseKwh: 3060,
    feedInKwh: 6250,
    annualSavingsEur: 0,
    investmentCostEur: 0,
  },
  {
    id: "5kwh",
    label: "Speicher 5 kWh",
    capacityKwh: 5,
    selfConsumptionPercent: 52,
    gridPurchaseKwh: 2160,
    feedInKwh: 5100,
    annualSavingsEur: 288,
    investmentCostEur: 5200,
  },
  {
    id: "7.5kwh",
    label: "Speicher 7,5 kWh",
    capacityKwh: 7.5,
    selfConsumptionPercent: 61,
    gridPurchaseKwh: 1755,
    feedInKwh: 4600,
    annualSavingsEur: 418,
    investmentCostEur: 6800,
  },
  {
    id: "10kwh",
    label: "Speicher 10 kWh",
    capacityKwh: 10,
    selfConsumptionPercent: 66,
    gridPurchaseKwh: 1530,
    feedInKwh: 4200,
    annualSavingsEur: 490,
    investmentCostEur: 8500,
  },
];

// Recommendation logic (simplified)
const RECOMMENDED_SCENARIO = MOCK_SCENARIOS[2]; // 7.5 kWh
const IS_BATTERY_RECOMMENDED = true;

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function SpeicherResultPage() {
  return (
    <div className="py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-16">
        {/* 1) KURZ-ZUSAMMENFASSUNG */}
        <SummarySection />

        {/* 2) GRUNDLAGE DER BERECHNUNG */}
        <CalculationBasisSection />

        {/* 3) ANNAHMEN ZUM STROMSPEICHER */}
        <BatteryAssumptionsSection />

        {/* 4) VERGLEICH DER SZENARIEN (JÄHRLICH) */}
        <AnnualComparisonSection />

        {/* 5) WIRTSCHAFTLICHKEIT ÜBER DIE LEBENSDAUER */}
        <LifetimeEconomicsSection />

        {/* 6) UNSERE EHRLICHE EMPFEHLUNG */}
        <RecommendationSection />

        {/* 7) NEXT STEPS */}
        <NextStepsSection />
      </div>
    </div>
  );
}

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

/**
 * 1) Summary Section – Top of page
 */
function SummarySection() {
  return (
    <section>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-6">
        Ergebnis für Ihr Haus – auf einen Blick
      </h1>

      {/* Main summary box */}
      <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/50 mb-6">
        {IS_BATTERY_RECOMMENDED ? (
          <div className="space-y-3">
            <p className="text-lg text-slate-200 leading-relaxed">
              Ein Stromspeicher ist für Ihr Haus grundsätzlich sinnvoll.
            </p>
            <p className="text-xl sm:text-2xl font-semibold text-slate-100">
              Die beste Balance aus Nutzen und Wirtschaftlichkeit bietet
              ein Speicher mit ca.{" "}
              <span className="text-amber-400">{RECOMMENDED_SCENARIO.capacityKwh} kWh</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xl sm:text-2xl font-semibold text-slate-100">
              Ein Stromspeicher lohnt sich für Ihr Haus aktuell nicht,
            </p>
            <p className="text-lg text-slate-300">
              da der zusätzliche Eigenverbrauch im Verhältnis zu den Kosten zu gering ist.
            </p>
          </div>
        )}
      </div>

      {/* Transparency statement */}
      <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
        <p className="text-sm text-slate-400 leading-relaxed">
          Unsere Empfehlung basiert auf Zahlen – nicht auf Verkaufsinteressen.
          Alle Annahmen und Berechnungen sind transparent dargestellt
          und können jederzeit angepasst werden.
        </p>
      </div>
    </section>
  );
}

/**
 * 2) Calculation Basis Section
 */
function CalculationBasisSection() {
  const inputData = [
    { label: "PV-Anlage", value: `${MOCK_INPUT.pvSizeKwp} kWp` },
    { label: "Standort", value: MOCK_INPUT.location },
    { label: "Dachausrichtung / Neigung", value: `${MOCK_INPUT.roofOrientation} / ${MOCK_INPUT.roofTilt}°` },
    { label: "Jährlicher Stromverbrauch", value: `${MOCK_INPUT.annualConsumptionKwh.toLocaleString("de-DE")} kWh` },
  ];

  const pvModelData = [
    { label: "Erwartete Jahreserzeugung", value: `${MOCK_PV_MODEL.expectedAnnualGenerationKwh.toLocaleString("de-DE")} kWh/Jahr` },
    { label: "Modell", value: `stündliche Simulation (${MOCK_PV_MODEL.simulationHours.toLocaleString("de-DE")} Stunden)` },
    { label: "Hinweis", value: "Vereinfachtes Ertragsmodell (keine Live-Daten)" },
  ];

  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6">
        Grundlage Ihrer Berechnung
      </h2>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Input data */}
        <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Ihre Eingaben
          </h3>
          <dl className="space-y-3">
            {inputData.map((item, i) => (
              <div key={i} className="flex justify-between">
                <dt className="text-slate-400 text-sm">{item.label}</dt>
                <dd className="text-slate-100 text-sm font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* PV model */}
        <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            PV-Erzeugung (Modell)
          </h3>
          <dl className="space-y-3">
            {pvModelData.map((item, i) => (
              <div key={i} className="flex justify-between gap-4">
                <dt className="text-slate-400 text-sm">{item.label}</dt>
                <dd className="text-slate-100 text-sm font-medium text-right">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-sm text-slate-500 leading-relaxed">
        Die PV-Erzeugung wird stündlich über ein gesamtes Jahr modelliert,
        um Erzeugung und Verbrauch zeitlich vergleichen zu können.
      </p>
    </section>
  );
}

/**
 * 3) Battery Assumptions Section
 */
function BatteryAssumptionsSection() {
  const assumptions = [
    { label: "Nutzbare Kapazität", value: "je nach Szenario (5 / 7,5 / 10 kWh)" },
    { label: "Lade-/Entladewirkungsgrad", value: `ca. ${Math.round(MOCK_BATTERY_ASSUMPTIONS.efficiency * 100)} %` },
    { label: "Durchschnittliche Zyklen pro Jahr", value: `ca. ${MOCK_BATTERY_ASSUMPTIONS.cyclesPerYear}` },
    { label: "Angenommene Lebensdauer", value: `${MOCK_BATTERY_ASSUMPTIONS.lifetimeYears} Jahre` },
    { label: "Gesamte Zyklen über Lebensdauer", value: `ca. ${MOCK_BATTERY_ASSUMPTIONS.totalLifetimeCycles.toLocaleString("de-DE")}` },
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
        Die Wirtschaftlichkeit eines Speichers ergibt sich nicht nur aus der Kapazität,
        sondern aus der tatsächlichen Nutzung über seine Lebensdauer.
      </p>
    </section>
  );
}

/**
 * 4) Annual Comparison Section
 */
function AnnualComparisonSection() {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6">
        Vergleich der Szenarien (jährlich)
      </h2>

      {/* Comparison table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Szenario</th>
              <th className="text-right py-3 px-4 text-slate-400 font-medium">Eigenverbrauch</th>
              <th className="text-right py-3 px-4 text-slate-400 font-medium">Netzbezug</th>
              <th className="text-right py-3 px-4 text-slate-400 font-medium">Einspeisung</th>
              <th className="text-right py-3 px-4 text-slate-400 font-medium">Ersparnis/Jahr</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_SCENARIOS.map((scenario, i) => {
              const isRecommended = scenario.id === RECOMMENDED_SCENARIO.id;
              return (
                <tr
                  key={scenario.id}
                  className={`border-b border-slate-800 ${
                    isRecommended ? "bg-amber-500/5" : ""
                  }`}
                >
                  <td className="py-4 px-4">
                    <span className={`font-medium ${isRecommended ? "text-amber-400" : "text-slate-100"}`}>
                      {scenario.label}
                    </span>
                    {isRecommended && (
                      <span className="ml-2 text-xs text-amber-400/70">(empfohlen)</span>
                    )}
                  </td>
                  <td className="text-right py-4 px-4 text-slate-200">
                    {scenario.selfConsumptionPercent} %
                  </td>
                  <td className="text-right py-4 px-4 text-slate-200">
                    {scenario.gridPurchaseKwh.toLocaleString("de-DE")} kWh
                  </td>
                  <td className="text-right py-4 px-4 text-slate-200">
                    {scenario.feedInKwh.toLocaleString("de-DE")} kWh
                  </td>
                  <td className="text-right py-4 px-4">
                    <span className={scenario.annualSavingsEur > 0 ? "text-emerald-400 font-medium" : "text-slate-400"}>
                      {scenario.annualSavingsEur > 0 ? `+${scenario.annualSavingsEur} €` : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Alle Ersparnisse beziehen sich auf ein Jahr und sind relativ zum Szenario „Ohne Speicher" angegeben.
      </p>
    </section>
  );
}

/**
 * 5) Lifetime Economics Section – MOST IMPORTANT
 */
function LifetimeEconomicsSection() {
  const lifetimeYears = MOCK_BATTERY_ASSUMPTIONS.lifetimeYears;
  
  // Calculate lifetime values
  const scenario5kwh = MOCK_SCENARIOS[1];
  const scenario10kwh = MOCK_SCENARIOS[3];
  
  const lifetime5kwh = {
    investment: scenario5kwh.investmentCostEur,
    annualSavings: scenario5kwh.annualSavingsEur,
    lifetimeSavings: scenario5kwh.annualSavingsEur * lifetimeYears,
  };
  
  const lifetime10kwh = {
    investment: scenario10kwh.investmentCostEur,
    annualSavings: scenario10kwh.annualSavingsEur,
    lifetimeSavings: scenario10kwh.annualSavingsEur * lifetimeYears,
  };
  
  const additionalInvestment = lifetime10kwh.investment - lifetime5kwh.investment;
  const additionalSavings = lifetime10kwh.lifetimeSavings - lifetime5kwh.lifetimeSavings;

  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-2">
        Wirtschaftlichkeit über die Lebensdauer des Speichers
      </h2>
      <p className="text-slate-400 mb-6">
        Betrachtungszeitraum: {lifetimeYears} Jahre
      </p>

      {/* Comparison: 5 kWh vs 10 kWh */}
      <div className="p-6 rounded-xl bg-slate-800/40 border border-slate-700/50 mb-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Vergleich: 5 kWh vs. 10 kWh
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 pr-4 text-slate-400 font-medium"></th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">5 kWh</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">10 kWh</th>
                <th className="text-right py-3 pl-4 text-slate-400 font-medium">Differenz</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800">
                <td className="py-3 pr-4 text-slate-300">Investitionskosten Speicher</td>
                <td className="text-right py-3 px-4 text-slate-100">
                  {lifetime5kwh.investment.toLocaleString("de-DE")} €
                </td>
                <td className="text-right py-3 px-4 text-slate-100">
                  {lifetime10kwh.investment.toLocaleString("de-DE")} €
                </td>
                <td className="text-right py-3 pl-4 text-rose-400">
                  +{additionalInvestment.toLocaleString("de-DE")} €
                </td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-3 pr-4 text-slate-300">Jährliche Ersparnis</td>
                <td className="text-right py-3 px-4 text-slate-100">
                  {lifetime5kwh.annualSavings} €
                </td>
                <td className="text-right py-3 px-4 text-slate-100">
                  {lifetime10kwh.annualSavings} €
                </td>
                <td className="text-right py-3 pl-4 text-emerald-400">
                  +{lifetime10kwh.annualSavings - lifetime5kwh.annualSavings} €
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-slate-200 font-medium">
                  Ersparnis über {lifetimeYears} Jahre
                </td>
                <td className="text-right py-3 px-4 text-slate-100 font-medium">
                  {lifetime5kwh.lifetimeSavings.toLocaleString("de-DE")} €
                </td>
                <td className="text-right py-3 px-4 text-slate-100 font-medium">
                  {lifetime10kwh.lifetimeSavings.toLocaleString("de-DE")} €
                </td>
                <td className="text-right py-3 pl-4 text-emerald-400 font-medium">
                  +{additionalSavings.toLocaleString("de-DE")} €
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Conclusion – MANDATORY */}
      <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Wirtschaftliche Bewertung
        </h3>
        <div className="space-y-3 text-slate-300 leading-relaxed">
          <p>
            Der größere Speicher (10 kWh) erfordert eine Mehrinvestition von{" "}
            <span className="text-slate-100 font-medium">{additionalInvestment.toLocaleString("de-DE")} €</span>,
            liefert über die angenommene Lebensdauer jedoch nur ca.{" "}
            <span className="text-slate-100 font-medium">{additionalSavings.toLocaleString("de-DE")} €</span> zusätzliche Ersparnis.
          </p>
          <p className="text-slate-100 font-medium">
            Aus wirtschaftlicher Sicht ist der kleinere Speicher die sinnvollere Wahl.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * 6) Recommendation Section
 */
function RecommendationSection() {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6">
        Unsere ehrliche Empfehlung
      </h2>

      <div className="p-6 rounded-xl bg-amber-500/5 border border-amber-500/20">
        {IS_BATTERY_RECOMMENDED ? (
          <div className="space-y-4 text-slate-200 leading-relaxed">
            <p>
              Für Ihr Haus ist ein Speicher mit ca.{" "}
              <span className="text-amber-400 font-semibold">{RECOMMENDED_SCENARIO.capacityKwh} kWh</span> sinnvoll,
              da er den größten Teil des abendlichen Verbrauchs abdeckt,
              ohne unverhältnismäßige Mehrkosten zu verursachen.
            </p>
            <p>
              Größere Speicher erhöhen den Eigenverbrauch nur noch geringfügig
              und sind aus wirtschaftlicher Sicht nicht effizient.
            </p>
            <div className="pt-2 border-t border-amber-500/10">
              <p className="text-sm text-slate-400">
                Diese Empfehlung basiert auf den Berechnungen in den obigen Abschnitten.
                Bei anderen Annahmen (z.B. höherer Strompreis, anderer Verbrauch)
                kann sich das Ergebnis ändern.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-slate-200 leading-relaxed">
            <p>
              Auf Basis der berechneten Zahlen empfehlen wir aktuell{" "}
              <span className="text-amber-400 font-semibold">keinen Stromspeicher</span>,
              da die Investition über die Lebensdauer nicht durch Einsparungen gedeckt wird.
            </p>
            <p>
              Bei steigenden Strompreisen oder veränderten Förderbedingungen
              kann sich diese Einschätzung in Zukunft ändern.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * 7) Next Steps Section
 */
function NextStepsSection() {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6">
        Wie geht es weiter?
      </h2>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* PDF Download (placeholder) */}
        <button
          disabled
          className="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 opacity-60 cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span>PDF-Bericht herunterladen</span>
          <span className="text-xs text-slate-500">(bald verfügbar)</span>
        </button>

        {/* Recalculate */}
        <Link
          href="/speicher/calculate"
          className="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span>Eingaben anpassen & neu berechnen</span>
        </Link>
      </div>

      {/* Calm note */}
      <p className="text-sm text-slate-500 text-center">
        Alle Annahmen und Ergebnisse bleiben nachvollziehbar und vergleichbar.
      </p>
    </section>
  );
}

