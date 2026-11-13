import Link from "next/link";
import EnergyDemo from "./home-demo/EnergyDemo";
import type { ReactNode } from "react";
function Panel({title,children}:{title:string;children:ReactNode}) {
  return <section className="min-w-0 border border-line-strong bg-surface"><h2 className="bg-accent px-3 py-2 font-mono text-xs font-medium uppercase tracking-[0.12em] text-white">{title}</h2>{children}</section>;
}
export default function SpeicherLandingPage() {
  return <div className="sg-calculate-chrome mx-auto max-w-frame px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-[9px]">
    <header className="mb-6 grid items-end gap-4 lg:grid-cols-[1fr_auto]">
      <div><p className="mb-2 font-mono text-xs uppercase tracking-[0.12em] text-ink-secondary">SPEICHERGRENZE / Technische Übersicht</p>
        <h1 className="text-[1.875rem] font-bold leading-none tracking-[-0.035em] sm:text-[2.375rem] lg:text-[2.875rem]">PV, Verbrauch und Speicher<br className="hidden sm:block"/> im zeitlichen Zusammenhang.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-secondary">Die Berechnung vergleicht Erzeugung und Bedarf in 15-Minuten-Schritten über ein Jahr. Unterschiedliche Speicherkapazitäten zeigen, wie viel Solarstrom zusätzlich im Haus genutzt werden kann.</p>
      </div><Link href="/calculate" className="inline-flex min-h-11 w-fit items-center justify-center self-end rounded-sm border border-ink bg-ink px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-ink-secondary">Speicher berechnen →</Link>
    </header>
    <div className="grid gap-2">
      <Panel title="01 / Energiefluss im Tagesverlauf"><EnergyDemo/></Panel>
      <Panel title="02 / So lesen Sie das Diagramm">
        <div className="grid gap-5 p-4 text-sm md:grid-cols-3">
          <div><h3 className="font-semibold">Erzeugung und Verbrauch vergleichen</h3><p className="mt-2 leading-relaxed text-ink-secondary">Jeder PV-Balken steht für 15 Minuten. Die dunkle Stufenlinie zeigt den gleichzeitigen Strombedarf. Liegt der Balken über der Linie, ist Solarstrom übrig. Liegt er darunter, fehlt Energie für den Haushalt.</p></div>
          <div><h3 className="font-semibold">Die Batterie verschiebt Energie</h3><p className="mt-2 leading-relaxed text-ink-secondary">Grüne Balken in der unteren Spur zeigen das Laden, braune Balken das Entladen. Ein voller Speicher kann keinen weiteren Überschuss aufnehmen; ein leerer keinen Bedarf decken. Dann wird Strom eingespeist oder aus dem Netz bezogen.</p></div>
          <div><h3 className="font-semibold">Ein Intervall genauer ansehen</h3><p className="mt-2 leading-relaxed text-ink-secondary">Bewegen Sie den Zeitregler: Die Werte darunter gehören genau zu dieser Viertelstunde. kW bezeichnet die mittlere Leistung im Intervall; SOC den Ladezustand am Intervallende. Sommer und Winter zeigen, wie unterschiedlich das Zusammenspiel ausfallen kann.</p></div>
        </div>
        <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-secondary">Das Diagramm verwendet frei gewählte Modellwerte. Es zeigt das Prinzip, keine Messung Ihres Haushalts und keine PVGIS-Ergebnisse. Ihre individuelle Jahresberechnung starten Sie über „Speicher berechnen“.</p>
      </Panel>
      <Panel title="03 / Von Ihren Angaben zur Speichergröße">
        <ol className="divide-y divide-line">
          {[
            { title: "Jahresverbrauch eingeben", label: "Ihre Angabe · kWh pro Jahr", text: "Sie geben den jährlichen Haushaltsstromverbrauch an, zum Beispiel 4.000 kWh aus Ihrer Stromabrechnung. Dieser Wert sagt, wie viel Strom insgesamt benötigt wird – aber noch nicht, zu welchen Tageszeiten. Wärmepumpe und Elektroauto können als zusätzliche Verbraucher separat berücksichtigt werden." },
            { title: "Den Verbrauch auf Viertelstunden verteilen", label: "BDEW H25 · Verbrauchsprofil", text: "Dafür verwenden wir das BDEW-Standardlastprofil H25. Es beschreibt einen typischen zeitlichen Verlauf des Haushaltsverbrauchs. BDEW hat H25 aus Bilanzierungsdaten von 62 Verteilnetzbetreibern der Jahre 2018 und 2019 entwickelt. Tageszeit, Wochentag und Jahreszeit bestimmen die Verteilung. Wir skalieren das Profil auf Ihren Jahresverbrauch: Bei 4.000 kWh ergeben alle Viertelstunden des Modelljahres zusammen wieder 4.000 kWh.", note: "So entsteht ein geschätzter Lastgang. Wann Sie persönlich kochen, waschen oder zu Hause sind, kann davon abweichen." },
            { title: "Die PV-Erzeugung am Standort berechnen", label: "PVGIS · Standort und PV-Anlage", text: "Aus Standort, Anlagenleistung, Ausrichtung und Neigung entsteht mithilfe von PVGIS ein zeitlicher Erzeugungsverlauf. Die Berechnung wertet 15 historische Wetterjahre von 2006 bis 2020 getrennt aus. Dadurch fließen unterschiedliche Wetterbedingungen ein.", note: "PVGIS liefert Stundenwerte. Diese werden energieerhaltend auf Viertelstunden verteilt; dadurch entstehen keine zusätzlich gemessenen 15-Minuten-Wetterdaten." },
            { title: "Beide Profile auf derselben Zeitachse abgleichen", label: "35.040 Intervalle pro Modelljahr", text: "Nun legen wir Erzeugung und Verbrauch übereinander – wie im Diagramm oben. In jedem Intervall wird zunächst der direkte Verbrauch gedeckt. Überschuss lädt die Batterie, bei einem Defizit wird sie entladen. Ladeleistung, verfügbare Kapazität und Verluste begrenzen den Energiefluss. Die verbleibende Differenz wird mit dem Stromnetz ausgeglichen." },
            { title: "Verschiedene Speichergrößen vergleichen", label: "Jahresauswertung · zusätzlicher Eigenverbrauch", text: "Die Simulation wird für unterschiedliche Kapazitäten wiederholt. So wird sichtbar, wie viel zusätzlichen Solarstrom jede Speichergröße nutzbar macht. Mit wachsender Kapazität nimmt dieser zusätzliche Nutzen ab: Ein größerer Speicher hilft nur, wenn ausreichend Überschuss zum Laden und später ausreichend Bedarf vorhanden sind. Daraus wird die technische Speichergrenze bestimmt; die planerische Speichergröße wird separat ausgewiesen." },
          ].map((step, i) => <li key={step.title} className="grid gap-3 p-4 sm:grid-cols-[2rem_1fr] lg:grid-cols-[2rem_18rem_1fr]">
            <span className="font-mono text-sm text-accent" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <div><h3 className="text-sm font-semibold">{step.title}</h3><p className="mt-1 text-xs text-ink-muted">{step.label}</p></div>
            <div className="text-sm leading-relaxed text-ink-secondary sm:col-start-2 lg:col-start-auto"><p>{step.text}</p>{step.note && <p className="mt-2 border-l-2 border-line-strong pl-3 text-xs leading-relaxed">{step.note}</p>}</div>
          </li>)}
        </ol>
      </Panel>
      <Panel title="04 / Mit realen Haushalten geprüft">
        <div className="grid gap-4 p-4 text-sm lg:grid-cols-[20rem_1fr]">
          <div><h3 className="font-semibold">Wie empfindlich ist das Ergebnis gegenüber dem Verbrauchsprofil?</h3><p className="mt-2 text-xs text-ink-muted">Separate Robustheitsprüfung · WPuQ</p></div>
          <div className="space-y-3 leading-relaxed text-ink-secondary"><p>Zusätzlich wurde das technische Modell mit gemessenen 15-Minuten-Lastgängen von 27 deutschen Einfamilienhäusern aus dem wissenschaftlichen WPuQ-Datensatz geprüft. Für diesen Vergleich bleiben Jahresverbrauch, PV-Anlage und Batteriemodell gleich; nur die zeitliche Verteilung des Haushaltsverbrauchs wird ausgetauscht.</p><p>Damit lässt sich untersuchen, wie stark reale Verbrauchsgewohnheiten das Ergebnis verändern. Die reguläre Berechnung verwendet weiterhin BDEW H25. Der Vergleich ist eine Robustheitsprüfung und keine Garantie für den einzelnen Haushalt.</p><Link href="/methodik/referenz" className="inline-block font-semibold text-accent underline underline-offset-4">Referenz und Prüfgrundlage ansehen →</Link></div>
        </div>
      </Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 border border-line px-4 py-3 text-sm"><p className="text-ink-secondary">Das Tagesbeispiel erklärt den Energiefluss. Die Speichergröße ergibt sich aus der Jahresberechnung.</p><Link href="/methodik" className="font-semibold text-accent underline underline-offset-4">Methodik nachlesen →</Link></div>
    </div>
  </div></div>;
}
