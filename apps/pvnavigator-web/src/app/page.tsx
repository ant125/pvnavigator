import {
  ArrowRight,
  Battery,
  BookOpen,
  Cpu,
  Home,
  Shield,
  Sprout,
  TrendingUp,
} from "lucide-react";

const badgeBase = "inline-flex w-fit rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1";

const productCardStatic =
  "relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-20px_rgba(15,23,42,0.1)] sm:p-7";

const productCardInteractive =
  "group relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-[#F59E0B]/30 hover:shadow-[0_20px_48px_-18px_rgba(15,23,42,0.14),0_0_0_1px_rgba(245,158,11,0.12)] sm:p-7";

const YT_CHANNEL = "https://www.youtube.com/@YOUR_CHANNEL";

export default function HomePage() {
  return (
    <div className="bg-[#FAFBFC]">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-7 pt-7 md:pb-8 md:pt-8">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-50/85 via-[#FFF9F2] to-[#FAFBFC]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-64 w-[min(100%,42rem)] -translate-x-1/2 rounded-full bg-[#F59E0B]/8 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium text-[#b45309]">PVNavigator</p>
          <h1 className="mt-3 text-[1.65rem] font-semibold leading-snug tracking-tight text-[#0F172A] sm:text-3xl md:text-[2rem]">
            Unabhängige Werkzeuge für bessere Photovoltaik-Entscheidungen.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[#64748B] md:text-[1.05rem]">
            Technisch fundierte Analysen für Speicher, Wirtschaftlichkeit und PV-Planung — transparent
            erklärt und unabhängig entwickelt.
          </p>

          <p className="mx-auto mt-5 max-w-lg text-xs leading-relaxed text-[#64748B] sm:text-[13px]">
            Entwickelt unabhängig · Keine Herstellerbindung · Transparent erklärt
          </p>
        </div>
      </section>

      {/* Tools */}
      <section id="werkzeuge" className="scroll-mt-24 px-4 py-9 md:py-11">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-xl font-semibold tracking-tight text-[#0F172A] sm:text-2xl md:text-[1.65rem]">
              Werkzeuge für Ihre PV-Entscheidung
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#64748B] sm:text-base">
              Professionelle Analyse-Tools für fundierte Entscheidungen rund um Photovoltaik.
            </p>
          </div>

          <div className="mt-8 grid auto-rows-fr gap-4 md:grid-cols-2 md:gap-5 lg:mt-9 lg:grid-cols-3">
            <a
              href="https://speicher.pvnavigator.de/"
              className={productCardInteractive}
            >
              <div className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 transition-colors group-hover:bg-[#F59E0B] group-hover:text-white group-hover:ring-[#F59E0B]">
                <Battery className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <span className={`${badgeBase} bg-emerald-50 text-emerald-800 ring-emerald-100/90`}>Live</span>
              <h3 className="mt-4 pr-12 text-lg font-semibold text-[#0F172A] transition-colors group-hover:text-[#b45309]">
                SpeicherGrenze
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[#64748B]">
                Simuliert den real nutzbaren Speicherbeitrag auf Basis von Verbrauch und PV-Erzeugung.
              </p>
              <div className="mt-6 border-t border-[#E2E8F0] pt-4">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F59E0B]">
                  Jetzt öffnen
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </div>
            </a>

            <div className={productCardStatic}>
              <div className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-[#E2E8F0]">
                <TrendingUp className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <span className={`${badgeBase} bg-slate-50 text-slate-600 ring-slate-200/90`}>
                In Entwicklung
              </span>
              <h3 className="mt-4 pr-12 text-lg font-semibold text-[#0F172A]">Wirtschaftlichkeitsanalyse</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[#64748B]">
                Bewertet Wirtschaftlichkeit, Amortisation und Szenarien für PV, Speicher, Wärmepumpe und
                E-Mobilität.
              </p>
              <div className="mt-6 border-t border-[#E2E8F0] pt-4">
                <span className="inline-flex rounded-full bg-slate-50 px-3.5 py-2 text-sm font-semibold text-[#94a3b8] ring-1 ring-[#E2E8F0]">
                  Demnächst
                </span>
              </div>
            </div>

            <div className={`${productCardStatic} md:col-span-2 lg:col-span-1`}>
              <div className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-[#E2E8F0]">
                <Home className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <span className={`${badgeBase} bg-amber-50/90 text-amber-900/80 ring-amber-100`}>Geplant</span>
              <h3 className="mt-4 pr-12 text-lg font-semibold text-[#0F172A]">PVShadow</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[#64748B]">
                Automatische Analyse von Dachgeometrie und Verschattung für präzisere PV-Planung.
              </p>
              <div className="mt-6 border-t border-[#E2E8F0] pt-4">
                <a
                  href={YT_CHANNEL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#64748B] transition-colors hover:text-[#F59E0B]"
                >
                  Mehr erfahren
                  <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section
        id="warum-pvnavigator"
        className="scroll-mt-24 border-y border-[#E2E8F0] bg-white px-4 py-9 md:py-11"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-xl font-semibold tracking-tight text-[#0F172A] sm:text-2xl md:text-[1.65rem]">
            Warum PVNavigator?
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-9 lg:grid-cols-4">
            {[
              {
                icon: Shield,
                title: "Unabhängig",
                text: "Keine Verkaufslogik. Keine Herstellerbindung.",
              },
              {
                icon: Cpu,
                title: "Technisch fundiert",
                text: "Berechnungen basieren auf nachvollziehbaren Modellen.",
              },
              {
                icon: BookOpen,
                title: "Verständlich",
                text: "Komplexe PV-Themen klar erklärt.",
              },
              {
                icon: Sprout,
                title: "Wachsend",
                text: "Weitere Analyse-Tools entstehen Schritt für Schritt.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-[#FAFBFC] p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.08)] sm:p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-100/90">
                  <item.icon className="h-5 w-5 text-[#d97706]" strokeWidth={2} aria-hidden />
                </div>
                <h3 className="mt-4 text-[0.95rem] font-semibold text-[#0F172A]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="so-funktioniert-es" className="scroll-mt-24 px-4 py-9 pb-11 md:py-11 md:pb-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-xl font-semibold tracking-tight text-[#0F172A] sm:text-2xl md:text-[1.65rem]">
            So funktioniert es
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-[#64748B]">
            Drei Schritte — ohne Schnörkel.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3 lg:mt-9">
            {[
              {
                step: "01",
                title: "Eingaben machen",
                text: "Verbrauch, PV-Daten oder später Ihre Adresse.",
              },
              {
                step: "02",
                title: "Analyse berechnen",
                text: "PVNavigator verarbeitet die Eingaben mit technischen Modellen.",
              },
              {
                step: "03",
                title: "Fundiert entscheiden",
                text: "Ergebnisse verstehen und bessere Entscheidungen treffen.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-6"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0F172A] text-[11px] font-bold tabular-nums tracking-tight text-white">
                  {s.step}
                </span>
                <h3 className="mt-4 text-[0.95rem] font-semibold text-[#0F172A]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
