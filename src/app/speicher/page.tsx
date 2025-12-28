import Link from "next/link";

/**
 * Speicher Module Landing Page
 * 
 * URL: speicher.pvnavigator.de (or /speicher in development)
 * 
 * This is the entry point for the Speicher-Rechner module.
 * Purpose: Explain the value proposition and guide users to the calculator.
 */

export default function SpeicherLandingPage() {
  return (
    <div className="space-y-0">
      {/* ========== HERO SECTION ========== */}
      <section className="relative py-20 px-4 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-amber-300 font-medium">
              Unabhängige Wirtschaftlichkeitsanalyse
            </span>
          </div>

          {/* Main heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="text-slate-100">PV Speicher – </span>
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              lohnt sich das?
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Wir zeigen, ob sich ein Stromspeicher für Ihr Haus lohnt – in Zahlen.
            Keine Verkaufsversprechen, nur transparente Berechnungen.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/speicher/calculate"
              className="px-8 py-4 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-lg transition-colors"
            >
              Speicher berechnen
            </Link>
            <button className="px-8 py-4 rounded-full border border-slate-600 text-slate-300 hover:border-slate-400 font-medium transition-colors">
              Beispielrechnung ansehen
            </button>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Unabhängig & neutral</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Transparente Methodik</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Keine Provision</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========== EXPLANATION SECTION ========== */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-4">
              Speicher verschiebt Energie in der Zeit
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Ein Stromspeicher macht Ihre PV-Anlage flexibler – aber rechnet sich das auch finanziell?
              Das hängt von vielen Faktoren ab.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">
                Eigenverbrauch erhöhen
              </h3>
              <p className="text-sm text-slate-400">
                Nutzen Sie mehr vom selbst erzeugten Strom – auch abends und nachts, wenn die Sonne nicht scheint.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">
                Wirtschaftlichkeit prüfen
              </h3>
              <p className="text-sm text-slate-400">
                Nicht jeder Speicher rechnet sich. Wir zeigen Ihnen ehrlich, wann sich die Investition lohnt – und wann nicht.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">
                Optimale Größe finden
              </h3>
              <p className="text-sm text-slate-400">
                Größer ist nicht immer besser. Wir berechnen die wirtschaftlich optimale Speichergröße für Ihr Verbrauchsprofil.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-4">
              So funktioniert die Berechnung
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-900 font-bold flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">Daten eingeben</h3>
              <p className="text-sm text-slate-400">
                PV-Größe, Standort, Dachausrichtung und Ihr Jahresverbrauch.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-900 font-bold flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">Simulation</h3>
              <p className="text-sm text-slate-400">
                Wir simulieren Ihr Lastprofil und die PV-Erzeugung über ein Jahr.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-900 font-bold flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">Ergebnis</h3>
              <p className="text-sm text-slate-400">
                Klare Zahlen: Eigenverbrauch, Ersparnis, Amortisation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="py-20 px-4 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-4">
            Bereit für die Analyse?
          </h2>
          <p className="text-slate-400 mb-8">
            Finden Sie heraus, ob sich ein Stromspeicher für Sie rechnet.
            Kostenlos und unverbindlich.
          </p>
          <Link
            href="/speicher/calculate"
            className="inline-flex px-8 py-4 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-lg transition-colors"
          >
            Speicher berechnen →
          </Link>
        </div>
      </section>
    </div>
  );
}

