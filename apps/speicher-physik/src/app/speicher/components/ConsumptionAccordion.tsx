"use client";

import { useState } from "react";
import {
  BDEW_H0_PROFILES,
  type BdewProfileKey,
  formatWeight,
} from "@bdew-profile/loader/chart";

/**
 * BDEW H0 Profile Chart - Always visible
 * 
 * Displays real hourly weights (w_h) from the BDEW Standardlastprofil H0.
 * This is NOT a demo chart - it shows the actual data used in calculations.
 */
export function BdewH0ProfileChart() {
  const [activeProfile, setActiveProfile] = useState<BdewProfileKey>("winter");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const currentProfile = BDEW_H0_PROFILES[activeProfile];
  const maxWeight = Math.max(...currentProfile.data);

  return (
    <div className="space-y-4">
      {/* Tab buttons with dates */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(BDEW_H0_PROFILES) as BdewProfileKey[]).map((key) => {
          const profile = BDEW_H0_PROFILES[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveProfile(key)}
              className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                activeProfile === key
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-slate-700/50 text-slate-400 border border-slate-600/50 hover:bg-slate-700 hover:text-slate-300"
              }`}
            >
              <span className="font-medium">{profile.label}</span>
              <span className="block text-[10px] opacity-70 mt-0.5">{profile.date}</span>
            </button>
          );
        })}
      </div>

      {/* Chart with tooltip */}
      <div className="relative">
        <div 
          className="h-40 flex items-end gap-0.5" 
          aria-label={`BDEW H0 Profil: ${currentProfile.label}`}
        >
          {currentProfile.data.map((weight, hour) => {
            const height = (weight / maxWeight) * 100;
            const isEvening = hour >= 17 && hour <= 21;
            const isMorning = hour >= 6 && hour <= 9;
            const isHovered = hoveredBar === hour;

            return (
              <div
                key={hour}
                className={`flex-1 rounded-t transition-all cursor-pointer ${
                  isHovered
                    ? "bg-amber-400"
                    : isEvening
                    ? "bg-amber-500/70"
                    : isMorning
                    ? "bg-amber-500/50"
                    : "bg-slate-500/60"
                }`}
                style={{ height: `${height}%` }}
                onMouseEnter={() => setHoveredBar(hour)}
                onMouseLeave={() => setHoveredBar(null)}
              />
            );
          })}
        </div>

        {/* Tooltip - positioned to the right of hovered bar, flips to left near edge */}
        {hoveredBar !== null && (() => {
          // Calculate horizontal position based on bar index
          // Each bar takes 1/24 of the width, tooltip appears to the right
          const barPercent = ((hoveredBar + 0.5) / 24) * 100;
          const isNearRightEdge = hoveredBar >= 17;
          
          return (
            <div 
              className="absolute pointer-events-none z-10"
              style={{ 
                // Vertical: fixed at 20% from top of chart area (well below tabs)
                top: "20%",
                // Horizontal: right of bar, or left if near edge
                left: isNearRightEdge ? "auto" : `calc(${barPercent}% + 8px)`,
                right: isNearRightEdge ? `calc(${100 - barPercent}% + 8px)` : "auto",
              }}
            >
              <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs">
                <p className="text-slate-100 font-medium whitespace-nowrap">{hoveredBar}:00 Uhr</p>
                <p className="text-amber-400 font-mono mt-1 whitespace-nowrap">
                  w<sub>h</sub> = {formatWeight(currentProfile.data[hoveredBar])}
                </p>
                <p className="text-slate-500 text-[10px] mt-1 leading-tight">
                  <span className="block">Anteil des Jahresverbrauchs</span>
                  <span className="block">in dieser Stunde</span>
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-slate-500 px-1">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>24h</span>
      </div>

      {/* Y-axis label */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Y-Achse: w<sub>h</sub> (Anteil des Jahresverbrauchs)</span>
        <span className="text-slate-600">Max: {formatWeight(maxWeight)}</span>
      </div>
    </div>
  );
}

/**
 * BDEW Data Explanation Block - mandatory text below chart
 */
export function BdewDataExplanation() {
  return (
    <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 space-y-3">
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Datengrundlage</p>
      <div className="text-sm text-slate-300 leading-relaxed space-y-2">
        <p>
          Die Grafik zeigt reale stündliche Gewichtungen (w<sub>h</sub>){" "}
          aus dem BDEW-Standardlastprofil H0.
        </p>
        <p>
          w<sub>h</sub> beschreibt den Anteil des Jahresverbrauchs,{" "}
          der in dieser Stunde anfällt.
        </p>
        <p className="text-slate-400">
          Die tatsächlichen kWh pro Stunde ergeben sich{" "}
          durch Skalierung mit dem individuellen Jahresverbrauch.
        </p>
      </div>
    </div>
  );
}

/**
 * Accordion component for consumption modeling explanations.
 * Single-open pattern: clicking one item closes others.
 * 
 * NOTE: The chart has been moved OUT of the accordion.
 * This accordion now contains only the explanatory text items.
 */
export function ConsumptionAccordion() {
  const [openItem, setOpenItem] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setOpenItem(openItem === id ? null : id);
  };

  return (
    <div className="space-y-0 border border-slate-700/50 rounded-xl overflow-hidden divide-y divide-slate-700/50">
      {/* Item 1: 4500 vs 7000 kWh (Scaling) */}
      <AccordionItem
        id="scaling"
        title="Wie sich Haushalte mit 4.500 oder 7.000 kWh unterscheiden"
        isOpen={openItem === "scaling"}
        onToggle={() => toggleItem("scaling")}
      >
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>
            Die Unterscheidung zwischen einem Haushalt mit 4.500 kWh und einem mit 7.000 kWh
            Jahresverbrauch liegt in zwei Dimensionen:
          </p>
          
          <div className="pl-4 border-l-2 border-slate-600 space-y-3">
            <div>
              <p className="text-slate-100 font-medium">1. Zeitlicher Verlauf (Form)</p>
              <p className="text-slate-400">
                Der tageszeitliche Verlauf – wann am meisten verbraucht wird – bleibt gleich.
                Morgens, mittags, abends: Die Kurve hat dieselbe Form.
              </p>
            </div>
            <div>
              <p className="text-slate-100 font-medium">2. Verbrauchsmenge (Skalierung)</p>
              <p className="text-slate-400">
                Was sich ändert, ist die Höhe: Ein 7.000-kWh-Haushalt verbraucht zu jeder Stunde
                proportional mehr als ein 4.500-kWh-Haushalt.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/30">
            <p className="text-slate-200 font-medium">
              „Die Kurve wird nicht verändert – sie wird skaliert."
            </p>
            <p className="text-slate-400 text-xs mt-2">
              Das bedeutet: Wir verwenden standardisierte Lastprofile und passen sie
              an Ihren tatsächlichen Jahresverbrauch an.
            </p>
          </div>
        </div>
      </AccordionItem>

      {/* Item 2: Why timing matters */}
      <AccordionItem
        id="timing"
        title="Warum das für die Speichergröße entscheidend ist"
        isOpen={openItem === "timing"}
        onToggle={() => toggleItem("timing")}
      >
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>
            Ein Stromspeicher verschiebt Energie in der Zeit. Er speichert überschüssigen
            PV-Strom tagsüber und gibt ihn abends wieder ab.
          </p>

          <p>
            Die entscheidende Frage ist daher nicht „Wie viel verbrauchen Sie im Jahr?",
            sondern:
          </p>

          <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-slate-200 font-medium">
              „Wie groß ist die zeitliche Überlappung zwischen Ihrer PV-Erzeugung
              und Ihrem Verbrauch?"
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-slate-400">
              <span className="text-slate-200">Hohe Überlappung</span> = wenig Speicherbedarf
              (z. B. Homeoffice, viel Verbrauch tagsüber)
            </p>
            <p className="text-slate-400">
              <span className="text-slate-200">Geringe Überlappung</span> = mehr Speicherbedarf
              (z. B. klassischer Haushalt, Verbrauch morgens & abends)
            </p>
          </div>

          <p className="text-slate-400">
            Der absolute Jahresverbrauch ist sekundär. Ein 7.000-kWh-Haushalt mit Homeoffice
            braucht unter Umständen einen kleineren Speicher als ein 4.500-kWh-Haushalt,
            der tagsüber nie zu Hause ist.
          </p>
        </div>
      </AccordionItem>

      {/* Item 3: Our assumptions */}
      <AccordionItem
        id="assumptions"
        title="Welche Annahmen wir bewusst treffen"
        isOpen={openItem === "assumptions"}
        onToggle={() => toggleItem("assumptions")}
      >
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>
            Transparenz bedeutet auch, die Grenzen unserer Modelle zu benennen:
          </p>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-slate-500 mt-0.5">•</span>
              <div>
                <span className="text-slate-200">Keine Smart-Meter-Daten</span>
                <p className="text-slate-400 text-xs mt-0.5">
                  Wir verwenden keine echten Messdaten Ihres Haushalts.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-slate-500 mt-0.5">•</span>
              <div>
                <span className="text-slate-200">Keine Einzelgeräte-Erkennung</span>
                <p className="text-slate-400 text-xs mt-0.5">
                  Wir modellieren den Gesamtverbrauch, nicht einzelne Verbraucher.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-slate-500 mt-0.5">•</span>
              <div>
                <span className="text-slate-200">BDEW-Standardlastprofil H0</span>
                <p className="text-slate-400 text-xs mt-0.5">
                  Die Grundlage bilden validierte Standardlastprofile der deutschen Energiewirtschaft.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-slate-500 mt-0.5">•</span>
              <div>
                <span className="text-slate-200">Ziel: nachvollziehbare Entscheidungsgrundlage</span>
                <p className="text-slate-400 text-xs mt-0.5">
                  Unsere Annahmen sind konservativ und dokumentiert – keine Black Box.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </AccordionItem>
    </div>
  );
}

/**
 * Single accordion item with controlled open/close state.
 */
function AccordionItem({
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
    <div className="bg-slate-800/30">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between cursor-pointer py-4 px-5 hover:bg-slate-800/50 transition-colors text-left"
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${id}`}
      >
        <span className="text-slate-100 font-medium text-sm pr-4">{title}</span>
        <svg
          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
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
        id={`accordion-content-${id}`}
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-5 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
