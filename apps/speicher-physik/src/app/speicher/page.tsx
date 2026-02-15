import Link from "next/link";

/**
 * Speicher Module Landing Page
 * 
 * URL: speicher.pvnavigator.de (or /speicher in development)
 * 
 * Professional, transparent, engineering-style landing page.
 * Target: Homeowners uncertain about battery storage sizing & economics.
 * Tone: Independent, calm, trustworthy – no sales pressure.
 */

export default function SpeicherLandingPage() {
  return (
    <div className="space-y-0">
      {/* ========== 1) HERO SECTION ========== */}
      <HeroSection />

      {/* ========== 2) HOW CALCULATION WORKS ========== */}
      <CalculationExplanationSection />

      {/* ========== 3) TRANSPARENCY – DATA & MODELS ========== */}
      <TransparencySection />

      {/* ========== 4) CONSUMPTION PATTERNS ========== */}
      <ConsumptionPatternsSection />

      {/* ========== 5) RESULTS & PDF SCENARIOS ========== */}
      <ResultsScenariosSection />

      {/* ========== 6) RECOMMENDATION SECTION ========== */}
      <RecommendationSection />

      {/* ========== 7) OFFER DATA ========== */}
      <OfferDataSection />

      {/* ========== 8) FINAL CTA ========== */}
      <FinalCTASection />
    </div>
  );
}

/* ============================================================
   SECTION COMPONENTS
   ============================================================ */

/**
 * 1) Hero Section – First screen
 */
function HeroSection() {
  return (
    <section className="py-20 md:py-28 px-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* Main headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-100 leading-tight mb-6">
          Brauchen Sie wirklich einen Stromspeicher –{" "}
          <span className="text-amber-400">und wenn ja, wie groß?</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
          Wir berechnen es unabhängig, transparent und ohne Verkaufsinteresse –
          basierend auf Ihrem Haus, Ihrer PV-Anlage und realistischen Verbrauchsmodellen.
        </p>

        {/* Key statement – emphasized */}
        <div className="py-8 px-6 mb-8 rounded-2xl bg-slate-800/40 border border-slate-700/50 max-w-2xl mx-auto">
          <p className="text-2xl sm:text-3xl font-semibold text-slate-100 mb-3">
            „Ein Stromspeicher verschiebt Energie in der Zeit."
          </p>
          <p className="text-slate-400">
            Wir zeigen Ihnen, ob sich das für Ihr Haus lohnt – in Zahlen.
          </p>
        </div>

        {/* Primary CTA */}
        <Link
          href="/speicher/calculate"
          className="inline-flex px-8 py-4 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-lg transition-colors"
        >
          Speicher berechnen
        </Link>
      </div>
    </section>
  );
}

/**
 * 2) How the Calculation Works
 */
function CalculationExplanationSection() {
  const steps = [
    {
      number: "1",
      title: "PV produziert tagsüber",
      text: "Ihre Photovoltaikanlage erzeugt Strom hauptsächlich mittags, wenn die Sonne scheint.",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ),
    },
    {
      number: "2",
      title: "Ihr Haushalt verbraucht abends",
      text: "Der Stromverbrauch in Wohnhäusern ist morgens und abends am höchsten – also genau dann, wenn die PV wenig oder nichts produziert.",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      number: "3",
      title: "Der Speicher verbindet beides",
      text: "Ein Speicher speichert überschüssigen Solarstrom vom Tag und stellt ihn abends zur Verfügung.",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-20 px-4 bg-slate-900/50">
      <div className="max-w-5xl mx-auto">
        {/* Section title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 text-center mb-16">
          So funktioniert unsere Berechnung
        </h2>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400">
                {step.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">
                {step.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {step.text}
              </p>
            </div>
          ))}
        </div>

        {/* Closing statement */}
        <div className="text-center">
          <p className="text-lg text-slate-200 font-medium max-w-2xl mx-auto">
            Genau hier entscheidet sich, ob ein Speicher sinnvoll ist – und welche Größe passt.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * 3) Transparency Section – Data & Models
 */
function TransparencySection() {
  const userInputs = [
    "Leistung Ihrer PV-Anlage (kWp)",
    "Adresse (für Sonneneinstrahlung)",
    "Dachausrichtung & Neigung",
    "Jährlicher Stromverbrauch",
  ];

  const systemCalculations = [
    "stündliche PV-Erzeugung über 8760 Stunden",
    "realistisches Haushalts-Verbrauchsprofil",
    "zeitlicher Überschuss und Bedarf",
    "Wirkung eines Stromspeichers Stunde für Stunde",
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 text-center mb-12">
          Welche Daten fließen in die Berechnung ein?
        </h2>

        {/* Two columns */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          {/* Left column – User inputs */}
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-100">Ihre Eingaben</h3>
            </div>
            <ul className="space-y-3">
              {userInputs.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                  <span className="text-amber-400 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right column – System calculation */}
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-100">Unsere Berechnung</h3>
            </div>
            <ul className="space-y-3">
              {systemCalculations.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                  <span className="text-amber-400 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust note */}
        <p className="text-center text-sm text-slate-500 max-w-xl mx-auto">
          Keine Smart-Meter, keine Live-Daten, keine Überwachung –
          nur saubere Modelle und nachvollziehbare Ergebnisse.
        </p>
      </div>
    </section>
  );
}

/**
 * 4) Consumption Patterns Section
 */
function ConsumptionPatternsSection() {
  const patterns = [
    {
      title: "Klassischer Haushalt",
      description: "Morgens & abends (Standard)",
      icon: "🏠",
    },
    {
      title: "Homeoffice / tagsüber zu Hause",
      description: "Mehr Verbrauch tagsüber",
      icon: "💻",
    },
    {
      title: "Schichtarbeit / unregelmäßig",
      description: "Verbrauch gleichmäßiger verteilt",
      icon: "🔄",
    },
    {
      title: "Ich weiß es genau",
      description: "(individuelle Einschätzung möglich)",
      icon: "📊",
    },
  ];

  return (
    <section className="py-20 px-4 bg-slate-900/50">
      <div className="max-w-5xl mx-auto">
        {/* Section title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 text-center mb-4">
          Wir berücksichtigen Ihren Tagesrhythmus
        </h2>

        {/* Intro text */}
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Ein Speicher lohnt sich nur, wenn Stromerzeugung und Verbrauch zeitlich auseinanderfallen.
        </p>

        {/* Pattern options */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {patterns.map((pattern, i) => (
            <div
              key={i}
              className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 transition-colors"
            >
              <div className="text-2xl mb-3">{pattern.icon}</div>
              <h3 className="font-medium text-slate-100 text-sm mb-1">
                {pattern.title}
              </h3>
              <p className="text-xs text-slate-500">{pattern.description}</p>
            </div>
          ))}
        </div>

        {/* Highlighted statement */}
        <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center">
          <p className="text-lg text-slate-200 font-medium">
            Wir rechnen nicht mit Durchschnittshäusern,
            <br className="hidden sm:block" />
            <span className="text-amber-400">sondern mit Ihrem Tagesrhythmus.</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * 5) Results & PDF Scenarios Section
 */
function ResultsScenariosSection() {
  const scenarios = [
    "Ohne Speicher",
    "Speicher 5 kWh",
    "Speicher 7,5 kWh",
    "Speicher 10 kWh",
  ];

  const metrics = [
    "Eigenverbrauchsanteil (%)",
    "Netzbezug (kWh/Jahr)",
    "Einspeisung (kWh/Jahr)",
    "Jährliche Ersparnis (€)",
    "Amortisation (bei Angebotsdaten besonders genau)",
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 text-center mb-4">
          Ihr Ergebnis – klar in Szenarien dargestellt
        </h2>

        {/* Intro */}
        <p className="text-slate-400 text-center mb-12">
          Im PDF-Bericht vergleichen wir für Ihr Haus:
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Scenarios */}
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
            <h3 className="font-semibold text-slate-100 mb-4">Szenarien</h3>
            <div className="space-y-3">
              {scenarios.map((scenario, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700/30"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 text-sm font-semibold">
                    {i}
                  </div>
                  <span className="text-slate-200 text-sm">{scenario}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
            <h3 className="font-semibold text-slate-100 mb-4">Für jedes Szenario zeigen wir</h3>
            <ul className="space-y-3">
              {metrics.map((metric, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                  <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {metric}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 6) Recommendation Section
 */
function RecommendationSection() {
  const questions = [
    "Lohnt sich ein Speicher überhaupt?",
    "Welche Größe passt zu Ihrem Haus?",
    "Ist ein vorliegendes Angebot sinnvoll, zu groß oder zu teuer?",
  ];

  return (
    <section className="py-20 px-4 bg-slate-900/50">
      <div className="max-w-3xl mx-auto">
        {/* Section title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 text-center mb-10">
          Unsere ehrliche Empfehlung
        </h2>

        {/* Questions */}
        <div className="space-y-4 mb-10">
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

        {/* Quote-style text */}
        <div className="p-8 rounded-2xl bg-slate-800/30 border-l-4 border-amber-500/50">
          <p className="text-slate-300 text-lg leading-relaxed">
            „Manchmal lautet die Antwort auch:
            <br />
            <span className="text-slate-100 font-medium">Ein Speicher lohnt sich aktuell nicht.</span>
            <br />
            Genau dafür gibt es diese Analyse."
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * 7) Offer Data Section
 */
function OfferDataSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Section title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 text-center mb-4">
          Sie haben bereits ein Angebot für einen Speicher?
        </h2>

        {/* Text */}
        <p className="text-slate-400 text-center mb-8 max-w-xl mx-auto">
          Optional können Sie Preis der PV-Anlage sowie Preis und Größe des Speichers angeben.
        </p>

        {/* Visual card */}
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div>
              <p className="text-slate-200 font-medium">Angebotsdaten eingeben</p>
              <p className="text-sm text-slate-500">für präzisere Ergebnisse</p>
            </div>
          </div>
          
          <p className="text-sm text-slate-400 leading-relaxed">
            Damit können wir die Wirtschaftlichkeit noch genauer berechnen.
            Sie können diese Daten jederzeit ändern oder später ergänzen.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * 8) Final CTA Section
 */
function FinalCTASection() {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-slate-900/50 to-slate-950">
      <div className="max-w-2xl mx-auto text-center">
        {/* Section title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-6">
          Klarheit statt Bauchgefühl
        </h2>

        {/* Closing lines */}
        <div className="space-y-2 mb-10 text-slate-400">
          <p>Kein Verkauf.</p>
          <p>Keine Herstellerbindung.</p>
          <p className="text-slate-200">Nur eine nachvollziehbare Entscheidungshilfe.</p>
        </div>

        {/* Final CTA */}
        <Link
          href="/speicher/calculate"
          className="inline-flex px-10 py-4 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-lg transition-colors"
        >
          Speicher jetzt berechnen
        </Link>

        {/* Subtle trust indicator */}
        <p className="mt-8 text-sm text-slate-600">
          Keine Registrierung erforderlich
        </p>
      </div>
    </section>
  );
}
