"use client";

import { useState } from "react";

/**
 * Compact methodology accordion for the Result Page.
 * Provides on-demand methodological context without cluttering results.
 * Single-open pattern, all items collapsed by default.
 */
export function MethodologyAccordion() {
  const [openItem, setOpenItem] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setOpenItem(openItem === id ? null : id);
  };

  return (
    <section className="p-5 rounded-xl bg-slate-800/20 border border-slate-700/40">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-200">
          Methodik & Annahmen (kurz erklärt)
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Details zur Berechnung – optional einsehbar
        </p>
      </div>

      {/* Accordion */}
      <div className="space-y-0 border border-slate-700/40 rounded-lg overflow-hidden divide-y divide-slate-700/40">
        {/* Item 1: Hourly Consumption Model */}
        <MiniAccordionItem
          id="hourly"
          title="Stündliches Verbrauchsmodell"
          isOpen={openItem === "hourly"}
          onToggle={() => toggleItem("hourly")}
        >
          <ul className="space-y-1.5 text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Die Berechnung basiert auf einer stündlichen Simulation (8.760 Stunden).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Der Haushaltsverbrauch folgt realistischen Lastprofilen mit typischen Tages- und Wochenverläufen.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Der Jahresverbrauchswert skaliert das Modell, das zeitliche Muster bleibt unverändert.</span>
            </li>
          </ul>
        </MiniAccordionItem>

        {/* Item 2: Typical Daily Patterns */}
        <MiniAccordionItem
          id="patterns"
          title="Typische Tagesverläufe"
          isOpen={openItem === "patterns"}
          onToggle={() => toggleItem("patterns")}
        >
          <ul className="space-y-1.5 text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Der Verbrauch unterscheidet sich zwischen morgens, mittags und abends.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Unterschiede zwischen Winter, Sommer und Wochenende werden berücksichtigt.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Beispielkurven sind auf der Startseite zur Veranschaulichung dargestellt.</span>
            </li>
          </ul>
        </MiniAccordionItem>

        {/* Item 3: PV, Consumption, Storage Interaction */}
        <MiniAccordionItem
          id="interaction"
          title="Zusammenspiel von PV, Verbrauch und Speicher"
          isOpen={openItem === "interaction"}
          onToggle={() => toggleItem("interaction")}
        >
          <ul className="space-y-1.5 text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>PV-Erzeugung und Haushaltsverbrauch werden Stunde für Stunde abgeglichen.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Überschüssige Energie kann gespeichert und später genutzt werden.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Der Speicher verschiebt Energie in der Zeit, nicht in der Menge.</span>
            </li>
          </ul>
        </MiniAccordionItem>

        {/* Item 4: Deliberate Simplifications */}
        <MiniAccordionItem
          id="simplifications"
          title="Bewusste Vereinfachungen"
          isOpen={openItem === "simplifications"}
          onToggle={() => toggleItem("simplifications")}
        >
          <ul className="space-y-1.5 text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Es werden keine Smart-Meter- oder Live-Messdaten verwendet.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Keine Modellierung einzelner Geräte.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>Die Ergebnisse stellen eine realistische Entscheidungsgrundlage dar, keine exakten Messungen.</span>
            </li>
          </ul>
        </MiniAccordionItem>
      </div>

      {/* Footer */}
      <p className="mt-3 text-xs text-slate-600 text-center">
        Ziel: Transparente Entscheidungsgrundlage – keine exakte Verbrauchsmessung.
      </p>
    </section>
  );
}

/**
 * Compact accordion item for methodology section.
 */
function MiniAccordionItem({
  id,
  title,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900/30">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between cursor-pointer py-2.5 px-4 hover:bg-slate-800/40 transition-colors text-left"
        aria-expanded={isOpen}
        aria-controls={`methodology-content-${id}`}
      >
        <span className="text-slate-300 text-xs font-medium pr-3">{title}</span>
        <svg
          className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        id={`methodology-content-${id}`}
        className={`overflow-hidden transition-all duration-150 ${
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-3 pt-1 text-xs leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}


