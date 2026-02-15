import { toolUrls } from "../config/toolUrls";

export default function HomePage() {
  const services = [
    {
      title: "Speicher Physik (FREE)",
      url: toolUrls.speicherPhysik,
      description: "1-Jahres-Modell, BDEW, PVGIS, Batteriesimulation – ohne Wirtschaft.",
    },
    {
      title: "Speicher Wirtschaft (PRO)",
      url: toolUrls.speicherWirtschaft,
      description: "15-Jahre-Aggregation, Degradation, Kostenmodell, Szenarien.",
    },
    {
      title: "PVShadow",
      url: toolUrls.pvshadow,
      description: "Geometrie, Dachanalyse, Verschattungsmodell.",
    },
  ];

  return (
    <div className="space-y-0">
      {/* ========== HERO ========== */}
      <section className="py-20 md:py-28 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-100 leading-tight mb-6">
            PVNavigator
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Unabhängige Tools rund um Photovoltaik – Physik, Wirtschaft, Planung.
          </p>
        </div>
      </section>

      {/* ========== SERVICE CARDS ========== */}
      <section className="py-12 px-4 bg-slate-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 text-center mb-12">
            Unsere Tools
          </h2>
          <div className="space-y-4">
            {services.map((service) => (
              <a
                key={service.title}
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 hover:border-amber-500/30 hover:bg-slate-800/60 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100 mb-2 group-hover:text-amber-400 transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                  <span className="flex-shrink-0 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
                    Öffnen →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ========== YOUTUBE ========== */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 text-center mb-8">
            YouTube
          </h2>
          <div className="flex justify-center">
            <a
              href="https://youtube.com/@YOUR_CHANNEL"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 hover:border-amber-500/30 transition-colors text-slate-200 hover:text-amber-400"
            >
              <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span className="font-medium">YouTube-Kanal</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
