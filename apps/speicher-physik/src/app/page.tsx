import Link from "next/link";
import { BatteryMedium, Car, Home, Thermometer } from "lucide-react";
import type { ReactNode } from "react";

const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover";

const LANDING_SHEET =
  "rounded-lg border border-line bg-surface p-6 shadow-sm sm:p-8";

const LANDING_SECTION = "border-t border-line py-16 lg:py-20";

const LANDING_SECTION_MUTED =
  "border-y border-line bg-surface-muted py-16 lg:py-20";

const LANDING_KICKER =
  "text-xs font-semibold uppercase tracking-wide text-accent-text";

const LANDING_H1 =
  "text-3xl font-semibold tracking-tight text-ink sm:text-4xl md:text-5xl leading-tight";

const LANDING_H2 =
  "text-2xl font-semibold tracking-tight text-ink sm:text-3xl";

const LANDING_BODY = "text-base leading-relaxed text-ink-secondary";

const LANDING_CARD =
  "rounded-lg border border-line bg-surface p-5 sm:p-6";

const LANDING_ICON_BOX =
  "flex h-12 w-12 items-center justify-center rounded-md border border-line bg-accent-soft text-accent-text";

const LANDING_FRAME = "max-w-frame mx-auto px-4 sm:px-6 lg:px-8";

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
    <div>
      <HeroSection />
      <CalculationExplanationSection />
      <WhatWeActuallyCalculateSection />
      <TransparencySection />
      <ConsumptionPatternsSection />
      <RecommendationSection />
      <FinalCTASection />
    </div>
  );
}

function LandingSection({
  muted = false,
  children,
}: {
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={muted ? LANDING_SECTION_MUTED : LANDING_SECTION}>
      <div className={LANDING_FRAME}>{children}</div>
    </section>
  );
}

function SectionHeader({
  kicker,
  title,
  intro,
  centered = true,
}: {
  kicker: string;
  title: string;
  intro?: ReactNode;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className={LANDING_KICKER}>{kicker}</p>
      <h2 className={`mt-2 ${LANDING_H2}`}>{title}</h2>
      {intro ? <div className="mt-4">{intro}</div> : null}
    </div>
  );
}

function StepIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/* ============================================================
   SECTION COMPONENTS
   ============================================================ */

function HeroPreviewPanel() {
  return (
    <div className={`${LANDING_SHEET} lg:shadow-md`}>
      <p className={LANDING_KICKER}>Ergebnis der Simulation</p>

      <div
        className="mt-5 rounded-md border border-line-soft bg-surface-muted p-4"
        aria-hidden
      >
        <svg
          viewBox="0 0 320 140"
          className="h-auto w-full"
          role="img"
          aria-label=""
        >
          <line
            x1="32"
            y1="108"
            x2="304"
            y2="108"
            stroke="var(--color-line)"
            strokeWidth="1"
          />
          <line
            x1="32"
            y1="20"
            x2="32"
            y2="108"
            stroke="var(--color-line)"
            strokeWidth="1"
          />
          {[40, 68, 96].map((y) => (
            <line
              key={y}
              x1="32"
              y1={y}
              x2="304"
              y2={y}
              stroke="var(--color-chart-grid)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}
          <path
            d="M 32 96 C 80 88, 120 72, 160 58 S 240 42, 304 38"
            fill="none"
            stroke="var(--color-chart-line)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle
            cx="208"
            cy="46"
            r="5"
            fill="var(--color-chart-marker)"
          />
          <line
            x1="208"
            y1="46"
            x2="208"
            y2="108"
            stroke="var(--color-chart-marker)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        </svg>
      </div>

      <div className="mt-5 grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2">
        <div>
          <p className="text-xs leading-snug text-ink-muted">
            technische Speichergrenze
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
            8,4 kWh
          </p>
        </div>
        <div>
          <p className="text-xs leading-snug text-ink-muted">
            planerische Kaufempfehlung als separate Planungsgröße
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-accent-text">
            10 kWh
          </p>
        </div>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-ink-muted">
        Basierend auf 8760h Simulation
      </p>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="border-b border-line bg-gradient-to-b from-accent-soft/30 to-canvas py-16 lg:py-20">
      <div className={LANDING_FRAME}>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="space-y-6">
            <p className={LANDING_KICKER}>Ganzjahres-Simulation</p>

            <h1 className={LANDING_H1}>
              Wie groß sollte Ihr Stromspeicher wirklich sein?
            </h1>

            <p className={LANDING_BODY}>
              Wir simulieren Ihr Haus Stunde für Stunde über ein ganzes Jahr.
              PV-Erzeugung am Standort, Ihr Stromverbrauch und optional Wärmepumpe
              oder Notstromreserve werden gemeinsam ausgewertet. So erkennen wir,
              ab welcher Speichergröße zusätzlicher Eigenverbrauch nur noch langsam
              zunimmt.
            </p>

            <blockquote className="border-l-2 border-accent pl-5">
              <p className="text-xl font-semibold text-ink sm:text-2xl">
                „Ein Stromspeicher verschiebt Solarstrom vom Tag in den Abend.“
              </p>
              <p className="mt-3 text-base leading-relaxed text-ink-secondary">
                Unsere Ergebnisse basieren auf physikalischer Simulation – nicht
                auf Verkaufsannahmen.
              </p>
            </blockquote>

            <Link href="/calculate" className={`${BTN_PRIMARY} px-8`}>
              Speicher berechnen
            </Link>
          </div>

          <HeroPreviewPanel />
        </div>
      </div>
    </section>
  );
}

function CalculationExplanationSection() {
  const steps = [
    {
      number: "01",
      title: "PV produziert tagsüber",
      text: "Ihre Photovoltaikanlage erzeugt Strom hauptsächlich mittags, wenn die Sonne scheint.",
      icon: (
        <StepIcon>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
          />
        </StepIcon>
      ),
    },
    {
      number: "02",
      title: "Ihr Haushalt verbraucht abends",
      text: "Der Stromverbrauch in Wohnhäusern ist morgens und abends am höchsten – also genau dann, wenn die PV wenig oder nichts produziert.",
      icon: (
        <StepIcon>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </StepIcon>
      ),
    },
    {
      number: "03",
      title: "Der Speicher verbindet beides",
      text: "Ein Speicher speichert überschüssigen Solarstrom vom Tag und stellt ihn abends zur Verfügung.",
      icon: (
        <StepIcon>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z"
          />
        </StepIcon>
      ),
    },
  ];

  return (
    <LandingSection>
      <div id="so-funktioniert" className="scroll-mt-24">
        <SectionHeader
          kicker="Energiefluss-Modell"
          title="So funktioniert unsere Berechnung"
        />
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {steps.map((step) => (
          <div key={step.number} className="text-center md:text-left">
            <p className="text-xs font-semibold tabular-nums text-accent-text">
              {step.number}
            </p>
            <div className={`${LANDING_ICON_BOX} mx-auto mt-3 md:mx-0`}>
              {step.icon}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              {step.text}
            </p>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-base font-medium leading-relaxed text-ink-secondary">
        Weil Erzeugung und Verbrauch zeitlich auseinanderliegen, ergibt sich daraus
        eine sinnvolle Speichergröße – und die Grenze, ab der mehr Kapazität wenig
        bringt.
      </p>
    </LandingSection>
  );
}

function WhatWeActuallyCalculateSection() {
  const items = [
    {
      number: "01",
      title: "PV-Erzeugung (PVGIS)",
      text: "Sonneneinstrahlung für Ihren Standort aus PVGIS.",
      icon: (
        <StepIcon>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
          />
        </StepIcon>
      ),
    },
    {
      number: "02",
      title: "Haushaltsverbrauch (BDEW + Anpassungen)",
      text: "Realistischer Tages- und Jahresverbrauch nach BDEW.",
      icon: (
        <StepIcon>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </StepIcon>
      ),
    },
    {
      number: "03",
      title: "Überschuss vs Bedarf pro Stunde",
      text: "Vergleich von PV-Erzeugung und Strombedarf in jeder Stunde.",
      icon: (
        <StepIcon>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
          />
        </StepIcon>
      ),
    },
    {
      number: "04",
      title: "Speicherung und Entladung Schritt für Schritt",
      text: "Laden und Entladen des Speichers inklusive Wirkungsgrad.",
      icon: (
        <StepIcon>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z"
          />
        </StepIcon>
      ),
    },
  ];

  return (
    <LandingSection muted>
      <SectionHeader
        kicker="Simulationsmodell"
        title="Was wir tatsächlich berechnen"
        intro={
          <p className="text-sm leading-relaxed text-ink-secondary">
            Wir simulieren jede Stunde eines gesamten Kalenderjahres (8.760
            Stunden). Grundlage sind die PV-Erzeugung am Standort (PVGIS) sowie
            ein realistischer Haushaltsverbrauch nach BDEW H0, optional ergänzt
            um ein Wärmepumpenprofil.
          </p>
        }
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.number} className={`${LANDING_CARD} flex gap-4`}>
            <div className={`${LANDING_ICON_BOX} shrink-0`}>{item.icon}</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tabular-nums text-accent-text">
                {item.number}
              </p>
              <h3 className="mt-1 text-base font-semibold text-ink">
                {item.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                {item.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-2xl space-y-3 text-center">
        <p className="text-sm leading-relaxed text-ink-secondary">
          Wir erhöhen die Speicherkapazität Schritt für Schritt und beobachten,
          wie sich der Eigenverbrauch verändert. Daraus erkennen wir, ab welcher
          Speichergröße zusätzliche Kapazität nur noch wenig Mehrwert bringt.
        </p>
        <p className="text-sm font-medium text-accent-text">
          Diese Schwelle wird als SpeicherGrenze ausgewiesen.
        </p>
      </div>
    </LandingSection>
  );
}

function TransparencySection() {
  const userInputs = [
    "PV-Anlage (kWp, ggf. mehrere Dachflächen)",
    "Standort / Adresse (für PVGIS-Sonneneinstrahlung)",
    "Dachausrichtung und Neigung",
    "Jährlicher Haushaltsverbrauch (ohne Wärmepumpe)",
    "Optional: Wärmepumpe (jährlicher Stromverbrauch)",
    "Optional: Notstromreserve (reservierte Speicherkapazität)",
  ];

  const systemCalculations = [
    "stündliche PV-Erzeugung über 8760 Stunden (PVGIS)",
    "Haushaltslastgang (BDEW H0, optional mit Wärmepumpenprofil)",
    "stündlicher PV-Überschuss und Strombedarf",
    "Speichersimulation Stunde für Stunde (Laden, Entladen und Verluste)",
    "technische Speichergrenze",
    "planerische Kaufempfehlung als separate Planungsgröße",
    "Eigenverbrauch und Autarkie auf Basis der technischen Speichergrenze",
  ];

  return (
    <LandingSection>
      <SectionHeader
        kicker="Datenbasis"
        title="Welche Daten fließen in die Berechnung ein?"
      />

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className={LANDING_SHEET}>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">
            Ihre Angaben
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className={LANDING_ICON_BOX}>
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-ink">Was Sie eingeben</h3>
          </div>
          <ul className="mt-4 space-y-2">
            {userInputs.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-ink-secondary"
              >
                <span className="mt-0.5 text-ink-muted">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className={LANDING_SHEET}>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">
            Ergebnis der Simulation
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className={LANDING_ICON_BOX}>
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-ink">Was daraus berechnet wird</h3>
          </div>
          <ul className="mt-4 space-y-2">
            {systemCalculations.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-ink-secondary"
              >
                <span className="mt-0.5 text-ink-muted">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-ink-muted">
        Keine Smart-Meter-Pflicht, keine Live-Telemetrie, keine
        Nutzerüberwachung — nur Modellparameter und nachvollziehbare
        Zwischenwerte.
      </p>
    </LandingSection>
  );
}

function ConsumptionPatternsSection() {
  const patterns = [
    {
      title: "Standard Haushalt",
      description: "Klassisches BDEW H0 Verbrauchsprofil.",
      icon: Home,
    },
    {
      title: "Haushalt mit Wärmepumpe",
      description:
        "Separater Stromverbrauch der Wärmepumpe mit saisonalem Verlauf und höherem Bedarf im Winter. Dadurch verändert sich der stündliche Lastgang und damit auch die berechnete SpeicherGrenze.",
      icon: Thermometer,
    },
    {
      title: "Elektroauto",
      description:
        "Bald verfügbar – ein Ladeprofil für Elektroautos wird derzeit noch nicht berücksichtigt.",
      icon: Car,
    },
    {
      title: "Notstrom-Reserve aktiv",
      description:
        "Ein Teil des Speichers bleibt bewusst ungenutzt für Stromausfälle.",
      icon: BatteryMedium,
    },
  ];

  return (
    <LandingSection muted>
      <SectionHeader
        kicker="Verbrauchsprofil"
        title="Ihr Tagesrhythmus entscheidet"
        intro={
          <div className="space-y-2 text-sm leading-relaxed text-ink-secondary">
            <p>
              Der tatsächliche Nutzen eines Speichers hängt vom zeitlichen
              Zusammenspiel zwischen PV-Erzeugung und Stromverbrauch ab.
            </p>
            <p>
              Der Haushaltsverbrauch wird stündlich modelliert. Eine Wärmepumpe
              kann als zusätzliches Verbrauchsprofil berücksichtigt werden.
            </p>
            <p>
              Eine Notstromreserve reduziert dagegen die im Alltag verfügbare
              Speicherkapazität.
            </p>
          </div>
        }
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {patterns.map((pattern, i) => {
          const Icon = pattern.icon;
          return (
            <div key={i} className={LANDING_CARD}>
              <div className={LANDING_ICON_BOX}>
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-ink">
                {pattern.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                {pattern.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className={`${LANDING_SHEET} mx-auto mt-8 max-w-2xl text-center`}>
        <p className="text-sm leading-relaxed text-ink-secondary">
          Kein generischer Referenzhaushalt für die Auslegung: Haushaltsverbrauch
          und optional Wärmepumpe werden stündlich mit der PV-Erzeugung am
          Standort abgeglichen. Eine aktivierte Notstromreserve wird in der
          Speichersimulation als reservierte Kapazität berücksichtigt.
        </p>
      </div>
    </LandingSection>
  );
}

function RecommendationSection() {
  const statements = [
    "Es gibt keine universell richtige Speichergröße. Welche Kapazität sinnvoll ist, hängt von Ihrem Haushalt, Ihrem Strombedarf, Ihren zukünftigen Plänen und Ihren persönlichen Zielen ab.",
    "Die SpeicherGrenze beantwortet genau eine Frage: Ab welcher Größe liefert zusätzliche Kapazität für Ihre heutigen Annahmen nur noch wenig zusätzlichen Eigenverbrauch?",
    "Sie ist ein technischer Orientierungspunkt aus der Simulation – keine Kaufempfehlung und keine allgemeingültige Speichergröße.",
  ];

  return (
    <LandingSection>
      <SectionHeader kicker="Ergebnislogik" title="Systemverhalten" />

      <div className="mx-auto mt-8 max-w-3xl divide-y divide-line-soft border-y border-line-soft">
        {statements.map((line, i) => (
          <div key={i} className="flex items-start gap-4 py-4">
            <span className="shrink-0 text-xs font-semibold tabular-nums text-accent-text">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-sm leading-relaxed text-ink-secondary">{line}</p>
          </div>
        ))}
      </div>

      <div
        className={`${LANDING_SHEET} mx-auto mt-8 max-w-3xl border-l-2 border-l-accent`}
      >
        <p className="text-sm leading-relaxed text-ink-secondary">
          Für Ihren heutigen Haushalt bedeutet das konkret:
        </p>
        <p className="mt-3 text-base font-semibold leading-relaxed text-accent-text">
          Oberhalb der SpeicherGrenze steigt der Eigenverbrauch mit jeder
          weiteren kWh nur noch langsam an.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
          Ein größerer Speicher kann dennoch sinnvoll sein – etwa bei höherem
          Haushaltsbedarf, einer Wärmepumpe (heute oder geplant), einem
          zukünftigen Elektroauto, weiterer Elektrifizierung oder einer größeren
          Notstromreserve. Die SpeicherGrenze ist ein technischer Bezugspunkt,
          keine Kaufempfehlung. Sie unterstützt Ihre Entscheidung, indem sie den
          messbaren Mehr-Eigenverbrauch der Simulation von Ihren persönlichen
          Planungszielen trennt.
        </p>
      </div>
    </LandingSection>
  );
}

function FinalCTASection() {
  return (
    <LandingSection muted>
      <div className={`${LANDING_SHEET} mx-auto max-w-2xl text-center`}>
        <p className={LANDING_KICKER}>Simulation starten</p>
        <h2 className={`mt-2 ${LANDING_H2}`}>Simulation ausführen</h2>

        <div className="mt-4 space-y-0.5 text-sm text-ink-muted">
          <p>Keine Verkaufslogik.</p>
          <p>Keine Herstellerbindung.</p>
          <p className="pt-1 text-ink-secondary">
            Alle Kennzahlen basieren auf demselben nachvollziehbaren
            Simulationsmodell.
          </p>
          <p className="pt-1 text-ink-secondary">
            Die Entscheidung treffen Sie – wir liefern die nachvollziehbare
            technische Grundlage.
          </p>
        </div>

        <Link href="/calculate" className={`${BTN_PRIMARY} mt-6 px-8`}>
          Speicher jetzt berechnen
        </Link>

        <p className="mt-4 text-xs text-ink-muted">
          Keine Registrierung erforderlich
        </p>
      </div>
    </LandingSection>
  );
}
