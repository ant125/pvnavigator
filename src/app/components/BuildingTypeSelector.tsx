"use client";

import {
  BuildingType,
  BUILDING_TYPE_OPTIONS,
  isBuildingTypeSupported,
} from "../types/building";

interface BuildingTypeSelectorProps {
  selectedType: BuildingType | null;
  onSelect: (type: BuildingType) => void;
  onBack?: () => void;
  onContinue: () => void;
  /** If true, this is the first step in the flow (no back button shown) */
  isFirstStep?: boolean;
}

/**
 * Building type selection component
 * 
 * Presents building type options as selectable cards.
 * Gates the automatic roof calculation - only Einfamilienhaus proceeds.
 * 
 * NEW: This is now the FIRST step in the analysis flow.
 * Unsupported building types are filtered before address input.
 */
export default function BuildingTypeSelector({
  selectedType,
  onSelect,
  onBack,
  onContinue,
  isFirstStep = false,
}: BuildingTypeSelectorProps) {
  const isSupported = isBuildingTypeSupported(selectedType);
  const canContinue = selectedType !== null && isSupported;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-sky-400">
          Schritt 1 von 4
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold">
          Gebäudetyp
        </h1>
        <p className="text-sm text-slate-300">
          Damit wir die richtige Berechnungsmethode für Ihr Dach wählen können.
        </p>
      </header>

      {/* BUILDING TYPE CARDS */}
      <div className="grid gap-3 sm:grid-cols-2">
        {BUILDING_TYPE_OPTIONS.map((option) => {
          const isSelected = selectedType === option.type;
          
          return (
            <button
              key={option.type}
              onClick={() => onSelect(option.type)}
              className={`
                relative p-4 rounded-xl border-2 text-left transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-sky-500/50
                ${isSelected
                  ? option.supported
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-amber-500 bg-amber-500/10"
                  : "border-slate-700 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-900/80"
                }
              `}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center ${
                  option.supported ? "bg-sky-500" : "bg-amber-500"
                }`}>
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Card content */}
              <div className="flex items-start gap-3">
                <span className="text-3xl" role="img" aria-hidden="true">
                  {option.emoji}
                </span>
                <div className="space-y-1">
                  <div className="font-semibold text-slate-100">
                    {option.label}
                  </div>
                  <div className="text-sm text-slate-400">
                    {option.description}
                  </div>
                </div>
              </div>

              {/* Supported badge */}
              {!option.supported && (
                <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Demnächst verfügbar
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* INFORMATIONAL MESSAGE FOR UNSUPPORTED TYPES */}
      {selectedType && !isSupported && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-amber-100">
                Die automatische Dachberechnung ist derzeit nur für freistehende Einfamilienhäuser verfügbar.
              </p>
              <p className="text-sm text-amber-200/70">
                Unterstützung für Mehrparteienhäuser und geteilte Dächer wird in einer zukünftigen Version hinzugefügt.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MESSAGE FOR SUPPORTED TYPE */}
      {selectedType && isSupported && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-emerald-100">
                Perfekt! Für freistehende Einfamilienhäuser können wir eine automatische Dachanalyse durchführen.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER WITH ACTIONS */}
      <footer className="flex justify-between items-center pt-4 border-t border-slate-800">
        {/* Back button - only shown if not the first step */}
        {!isFirstStep && onBack ? (
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-full text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            ← Zurück
          </button>
        ) : (
          <div /> /* Empty div to maintain flex spacing */
        )}

        <div className="flex items-center gap-3">
          {/* Notify me button for unsupported types */}
          {selectedType && !isSupported && (
            <button
              onClick={() => {
                // TODO: Implement notification signup
                alert("Vielen Dank! Wir benachrichtigen Sie, sobald diese Funktion verfügbar ist.");
              }}
              className="px-4 py-2 rounded-full text-sm font-medium border border-slate-600 text-slate-300 hover:border-slate-500 hover:bg-slate-800 transition-colors"
            >
              Benachrichtigen
            </button>
          )}

          <button
            disabled={!canContinue}
            onClick={onContinue}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${
              canContinue
                ? "bg-sky-500 hover:bg-sky-400 text-white"
                : "bg-slate-700 text-slate-400 cursor-not-allowed"
            }`}
          >
            Weiter
          </button>
        </div>
      </footer>
    </div>
  );
}

