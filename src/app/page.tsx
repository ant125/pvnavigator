import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-2xl text-center space-y-6">
        <p className="text-sm uppercase tracking-[0.25em] text-sky-400">
          PV Navigator
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
          Ihr smarter Weg zur richtigen Photovoltaik-Anlage.
        </h1>
        <p className="text-sm sm:text-base text-slate-300">
          Unabhängige Analyse statt Verkaufsversprechen: 
          Wir berechnen Ertrag, Eigenverbrauch und Amortisation Ihrer PV-Anlage – inklusive realer Verschattungsverluste durch Nachbargebäude und Bäume, sowie Szenarien mit Stromspeicher, Elektroauto, Warmwasser und Wärmepumpe.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/analyse"
            className="px-6 py-3 rounded-full bg-sky-500 hover:bg-sky-400 text-sm font-semibold"
          >
            Analyse anfordern
          </Link>
          <button className="px-6 py-3 rounded-full border border-slate-600 text-sm text-slate-300 hover:border-slate-400">
            Musterbericht (bald verfügbar)
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Keine Verkaufsberatung, keine versteckte Provision – 
          wir zeigen Ihnen realistische Zahlen.
        </p>
      </div>
    </main>
  );
}