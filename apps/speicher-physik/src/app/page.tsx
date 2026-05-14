import Link from "next/link";

const btnEnergy =
  "inline-flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 active:scale-[0.98] transition-all duration-200 hover:scale-[1.03] shadow-[0_0_0_rgba(0,0,0,0)] hover:shadow-[0_0_20px_rgba(34,197,94,0.25)] text-white font-semibold";

const cardSurface = "bg-[#0F1620] border border-white/5";

const cardInteractive =
  "transition-all duration-200 hover:bg-[#131A23] hover:border-white/10 hover:-translate-y-1 hover:shadow-lg";

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

      {/* ========== 2b) WHAT WE CALCULATE ========== */}
      <WhatWeActuallyCalculateSection />

      {/* ========== 3) TRANSPARENCY – DATA & MODELS ========== */}
      <TransparencySection />

      {/* ========== 4) CONSUMPTION PATTERNS ========== */}
      <ConsumptionPatternsSection />

      {/* ========== 6) RECOMMENDATION SECTION ========== */}
      <RecommendationSection />

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
    <section className="relative min-h-[70vh] flex items-center overflow-hidden pt-20 pb-20 px-4">
      <div className="absolute inset-0 bg-[#0B0F14]" aria-hidden />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-green-500/[0.06] blur-[160px]" />
      </div>
      <div className="relative z-10 max-w-4xl mx-auto text-center w-full space-y-6">
        <div className="text-xs font-mono text-green-400/70 mb-2 tracking-wider">
          ● Ganzjahres-Simulation
        </div>

        {/* Main headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
          Wie groß sollte Ihr Stromspeicher wirklich sein?
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
          Wir simulieren ein ganzes Jahr Ihres Haushalts – mit realistischen Verbrauchsprofilen und
          PV-Erzeugung.
        </p>

        {/* Key statement – emphasized */}
        <div className={`p-4 rounded-xl max-w-2xl mx-auto ${cardSurface}`}>
          <p className="text-xl sm:text-2xl font-semibold text-white mb-3">
            „Ein Stromspeicher verschiebt Solarstrom vom Tag in den Abend.“
          </p>
          <p className="text-base text-white/50">
            Unsere Ergebnisse basieren auf physikalischer Simulation – nicht auf Verkaufsannahmen.
          </p>
        </div>

        {/* Primary CTA */}
        <Link href="/calculate" className={`${btnEnergy} px-8 py-3 rounded-lg text-base`}>
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
        <svg className="h-6 w-6 transition-transform duration-200 transform-gpu origin-center hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(34,197,94,0.25)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ),
    },
    {
      number: "2",
      title: "Ihr Haushalt verbraucht abends",
      text: "Der Stromverbrauch in Wohnhäusern ist morgens und abends am höchsten – also genau dann, wenn die PV wenig oder nichts produziert.",
      icon: (
        <svg className="h-6 w-6 transition-transform duration-200 transform-gpu origin-center hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(34,197,94,0.25)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      number: "3",
      title: "Der Speicher verbindet beides",
      text: "Ein Speicher speichert überschüssigen Solarstrom vom Tag und stellt ihn abends zur Verfügung.",
      icon: (
        <svg className="h-6 w-6 transition-transform duration-200 transform-gpu origin-center hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(34,197,94,0.25)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-16 px-4 bg-[#0E131A]">
      <div className="max-w-5xl mx-auto">
        <div className="text-xs font-mono text-green-400/70 text-center mb-2 tracking-wider">
          ● Energiefluss-Modell
        </div>
        {/* Section title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-12">
          So funktioniert unsere Berechnung
        </h2>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 mb-10">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">
                STEP {step.number}
              </p>
              <div
                className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${cardSurface} text-green-400/80 opacity-80 shadow-[0_0_12px_rgba(34,197,94,0.15)]`}
              >
                {step.icon}
              </div>
              <h3 className="mt-2 text-lg text-white font-medium mb-1">
                {step.title}
              </h3>
              <p className="text-white/60 text-sm leading-snug max-w-2xl mx-auto">
                {step.text}
              </p>
            </div>
          ))}
        </div>

        {/* Closing statement */}
        <div className="text-center">
          <p className="text-base text-white/60 font-medium max-w-2xl mx-auto">
            Aus Zeitversatz zwischen Erzeugung und Last folgt der nutzbare Speicherbeitrag — und eine sinnvolle Kapazitätsgrenze.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * 2b) What we actually calculate – hourly simulation scope
 */
function WhatWeActuallyCalculateSection() {
  const items = [
    {
      number: "1",
      title: "PV-Erzeugung (PVGIS)",
      text: "",
      icon: (
        <svg className="h-6 w-6 transition-transform duration-200 transform-gpu origin-center hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(34,197,94,0.25)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ),
    },
    {
      number: "2",
      title: "Haushaltsverbrauch (BDEW + Anpassungen)",
      text: "",
      icon: (
        <svg className="h-6 w-6 transition-transform duration-200 transform-gpu origin-center hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(34,197,94,0.25)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      number: "3",
      title: "Überschuss vs Bedarf pro Stunde",
      text: "",
      icon: (
        <svg className="h-6 w-6 transition-transform duration-200 transform-gpu origin-center hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(34,197,94,0.25)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
    },
    {
      number: "4",
      title: "Speicherung und Entladung Schritt für Schritt",
      text: "",
      icon: (
        <svg className="h-6 w-6 transition-transform duration-200 transform-gpu origin-center hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(34,197,94,0.25)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-16 px-4 bg-[#0B0F14]">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-xs text-green-400/70 text-center mb-2 tracking-wider">
          ● Simulationsmodell
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-4">
          Was wir tatsächlich berechnen
        </h2>
        <p className="text-white/60 text-center mb-10 max-w-2xl mx-auto text-sm leading-relaxed">
          Zeitdiskretes Modell mit Δt = 1 h über n = 8760 Stunden (Kalenderjahr). Randbedingungen: PV-Zeitreihe (PVGIS), parametrisierter Haushaltslastgang (BDEW + Profile).
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          {items.map((item) => (
            <div key={item.number} className="text-center">
              <div
                className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${cardSurface} text-green-400/80 opacity-80 shadow-[0_0_12px_rgba(34,197,94,0.15)]`}
              >
                {item.icon}
              </div>
              <h3 className="mt-2 text-lg text-white font-medium mb-1">
                {item.title}
              </h3>
              <p className="text-white/60 text-sm leading-snug min-h-[1.25rem] max-w-2xl mx-auto">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center space-y-3">
          <p className="text-sm text-white/60 max-w-2xl mx-auto leading-relaxed">
            Speicherkapazität wird schrittweise erhöht; die Ableitung des Grenznutzens zeigt, ab wann zusätzliche kWh kaum noch Eigenverbrauch oder Autarkie erhöhen.
          </p>
          <p className="text-sm text-green-400 font-medium max-w-2xl mx-auto">
            Diese Schwelle wird als SpeicherGrenze ausgewiesen.
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
    <section className="py-16 px-4 bg-[#0E131A]">
      <div className="max-w-5xl mx-auto">
        <div className="text-xs font-mono text-green-400/70 text-center mb-2 tracking-wider">
          ● Datenbasis
        </div>
        {/* Section title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-10">
          Welche Daten fließen in die Berechnung ein?
        </h2>

        {/* Two columns */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Left column – User inputs */}
          <div
            className={`p-6 rounded-xl ${cardSurface} ${cardInteractive}`}
          >
            <p className="font-mono text-xs text-green-400/70 mb-2 tracking-wide">
              MODEL INPUT
            </p>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#0B0F14] border border-white/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white">Randbedingungen (Eingabe)</h3>
            </div>
            <ul className="space-y-2">
              {userInputs.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-white/60 text-sm">
                  <span className="text-white/40 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right column – System calculation */}
          <div
            className={`p-6 rounded-xl ${cardSurface} ${cardInteractive}`}
          >
            <p className="font-mono text-xs text-green-400/70 mb-2 tracking-wide">
              MODEL OUTPUT
            </p>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#0B0F14] border border-white/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <h3 className="font-semibold text-white">Zeitreihen & Bilanz</h3>
            </div>
            <ul className="space-y-2">
              {systemCalculations.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-white/60 text-sm">
                  <span className="text-white/40 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust note */}
        <p className="text-center text-xs text-white/40 max-w-xl mx-auto leading-relaxed">
          Keine Smart-Meter-Pflicht, keine Live-Telemetrie, keine Nutzerüberwachung — nur Modellparameter und auditierbare Zwischengrößen.
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
      title: "Standard Haushalt",
      description: "Klassisches BDEW H0 Verbrauchsprofil.",
      icon: "🏠",
      iconClass: "text-blue-400",
    },
    {
      title: "Haushalt mit Wärmepumpe",
      description: "Höherer Verbrauch im Winter und in den Abendstunden.",
      icon: "🌡️",
      iconClass: "text-orange-400",
    },
    {
      title: "Haushalt mit Elektroauto",
      description: "Zusätzlicher Verbrauch, meist abends oder nachts.",
      icon: "🚗",
      iconClass: "text-purple-400",
    },
    {
      title: "Notstrom-Reserve aktiv",
      description: "Ein Teil des Speichers bleibt bewusst ungenutzt für Stromausfälle.",
      icon: "🔋",
      iconClass: "text-yellow-400/80",
    },
  ];

  return (
    <section className="py-16 px-4 bg-[#0B0F14]">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-xs text-green-400/70 text-center mb-2 tracking-wider">
          ● Verbrauchsprofil
        </div>
        <div className="mx-auto max-w-md pb-6">
          {/* Section title */}
          <h2 className="text-center text-2xl font-bold leading-tight text-white sm:text-3xl">
            Ihr Tagesrhythmus entscheidet
          </h2>

          {/* Intro text */}
          <div className="mt-4 space-y-2 text-center text-sm leading-relaxed text-white/60">
            <p>
              Ein Speicher wirkt am besten, wenn Erzeugung und Verbrauch zeitlich auseinanderliegen.
            </p>
            <p>Der Lastgang wird über reale Profile modelliert.</p>
          </div>
        </div>

        {/* Pattern options */}
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {patterns.map((pattern, i) => (
            <div
              key={i}
              className={`p-5 rounded-xl ${cardSurface} ${cardInteractive}`}
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center">
                <span
                  className={`inline-flex items-center justify-center text-xl transition-transform duration-200 transform-gpu origin-center hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(34,197,94,0.25)] opacity-80 ${pattern.iconClass}`}
                >
                  {pattern.icon}
                </span>
              </div>
              <h3 className="font-medium text-white/80 text-sm mb-1">
                {pattern.title}
              </h3>
              <p className="text-xs text-white/50 leading-snug">
                {pattern.description}
              </p>
            </div>
          ))}
        </div>

        {/* Highlighted statement */}
        <div
          className={`p-5 rounded-xl ${cardSurface} text-center max-w-2xl mx-auto ${cardInteractive}`}
        >
          <p className="text-sm text-white/60 leading-relaxed max-w-2xl mx-auto">
            Kein generischer Referenzhaushalt für die Auslegung — parametrisierte Profile und Jahresenergie bilanzieren mit Ihrer PV-Zeitreihe.
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
  const statements = [
    "Nutzen und Autarkiezuwachs folgen aus der stündlichen Bilanz — nicht aus Nominaldaten des Speichers.",
    "Aus konsekutiver Simulation der Speichergröße ergibt sich die SpeicherGrenze als Punkt abnehmenden Grenznutzens.",
    "Vorliegende Angebotsdaten dienen dem Abgleich mit den Modellgrößen — nicht als alleinige Optimierungsgröße.",
  ];

  return (
    <section className="py-16 px-4 bg-[#0E131A]">
      <div className="max-w-3xl mx-auto">
        <div className="text-xs font-mono text-green-400/70 text-center mb-2 tracking-wider">
          ● SYSTEM STATE
        </div>
        {/* Section title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-6">
          Systemverhalten
        </h2>

        {/* Declarative statements */}
        <div className="space-y-3 mb-6">
          {statements.map((line, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-4 rounded-xl ${cardSurface} ${cardInteractive}`}
            >
              <span className="text-green-400/80 text-xs font-mono mt-1 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-white/60 text-sm leading-relaxed max-w-2xl">{line}</span>
            </div>
          ))}
        </div>

        {/* Core statement */}
        <div className={`p-6 rounded-xl ${cardSurface} ${cardInteractive}`}>
          <p className="text-white/50 text-sm leading-relaxed mb-3 max-w-2xl">
            Typisches Ergebnis der Grenzwertbetrachtung:
          </p>
          <p className="text-green-400 font-medium text-base leading-relaxed max-w-2xl">
            Ein größerer Speicher bringt kaum zusätzlichen Nutzen.
          </p>
          <p className="text-white/50 text-sm mt-4 leading-relaxed max-w-2xl">
            Optimierungsziel ist physikalischer Mehreigenverbrauch bzw. Netzbezugsreduktion — keine Preis- oder Absatzlogik.
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
    <section className="py-14 px-4 bg-[#0B0F14]">
      <div className="max-w-2xl mx-auto text-center">
        <div className="text-xs font-mono text-green-400/70 mb-2 tracking-wider">
          ● Simulation starten
        </div>
        {/* Section title */}
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
          Simulation ausführen
        </h2>

        {/* Closing lines */}
        <div className="space-y-0.5 mb-5 text-white/50 text-sm">
          <p>Keine Verkaufslogik.</p>
          <p>Keine Herstellerbindung.</p>
          <p className="text-white/60 pt-1 max-w-2xl mx-auto">
            Nachvollziehbare Kennzahlen aus dem gleichen Modellpfad wie oben beschrieben.
          </p>
        </div>

        {/* Final CTA */}
        <Link href="/calculate" className={`${btnEnergy} px-8 py-3 rounded-lg text-base`}>
          Speicher jetzt berechnen
        </Link>

        {/* Subtle trust indicator */}
        <p className="mt-4 text-xs text-white/40">
          Keine Registrierung erforderlich
        </p>
      </div>
    </section>
  );
}
