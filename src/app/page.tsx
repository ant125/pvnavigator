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
          Bald verfügbar: unabhängiger Photovoltaik-Rechner,
          Wirtschaftlichkeitsbericht als PDF und geprüfte
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button className="px-6 py-3 rounded-full bg-sky-500 hover:bg-sky-400 text-sm font-semibold">
            PV-Rechner demnächst verfügbar
          </button>
          <button className="px-6 py-3 rounded-full border border-slate-600 text-sm text-slate-300 hover:border-slate-400">
            Projekt: PV Navigator – im Aufbau
          </button>
        </div>
      </div>
    </main>
  );
}