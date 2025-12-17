"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import DraggableMap from "../components/DraggableMapComponent";
import DebugLocationPanel from "../components/DebugLocationPanel";
import BuildingTypeSelector from "../components/BuildingTypeSelector";
import {
  AddressForm,
  Coordinates,
  ConfirmedLocation,
  LocationSource,
  createConfirmedLocation,
} from "../types/location";
import { BuildingType, isBuildingTypeSupported } from "../types/building";

/**
 * Debug panel visibility flag
 * 
 * Debug panel enabled for development — positioned bottom-left for better UX.
 * Set to false to disable during UX review if needed.
 */
const SHOW_DEBUG_PANEL = true;

/**
 * Analysis flow steps
 * 
 * NEW ORDER (building type first):
 * 1. building_type — User selects building type (hard gate for MVP)
 * 2. address — Address input + map marker confirmation (only for supported types)
 * 3. analysing — Automatic analysis
 */
type AnalysisStep = "building_type" | "address" | "analysing";

export default function AnalysePage() {
  /* -------------------------
     Текущий шаг анализа
     Current analysis step
     
     IMPORTANT: Building type is now the FIRST step
     to filter unsupported cases before address input
  ------------------------- */
  const [currentStep, setCurrentStep] = useState<AnalysisStep>("building_type");

  /* -------------------------
     Состояние формы адреса
     Address form state
  ------------------------- */
  const [address, setAddress] = useState<AddressForm>({
    plz: "",
    ort: "",
    strasse: "",
    hausnummer: "",
  });

  /* -------------------------
     Координаты дома (после геокодинга или перетаскивания)
     House coordinates (after geocoding or dragging)
  ------------------------- */
  const [coords, setCoords] = useState<Coordinates | null>(null);

  /* -------------------------
     Источник координат: "geocode" или "user_marker"
     Source of coordinates: "geocode" or "user_marker"
  ------------------------- */
  const [locationSource, setLocationSource] = useState<LocationSource>("geocode");

  /* -------------------------
     Флаг: пользователь передвинул маркер
     Flag: user has manually adjusted the marker
  ------------------------- */
  const [markerWasDragged, setMarkerWasDragged] = useState(false);

  /* -------------------------
     Подтверждение адреса пользователем
     User confirmation checkbox
  ------------------------- */
  const [isAddressConfirmed, setIsAddressConfirmed] = useState(false);

  /* -------------------------
     Финальная подтверждённая локация (source of truth)
     Final confirmed location (source of truth for all downstream calculations)
  ------------------------- */
  const [confirmedLocation, setConfirmedLocation] = useState<ConfirmedLocation | null>(null);

  /* -------------------------
     Тип здания
     Building type
  ------------------------- */
  const [buildingType, setBuildingType] = useState<BuildingType | null>(null);

  /* -------------------------
     Предыдущий адрес для предотвращения повторного геокодинга
     Previous address to prevent redundant geocoding
  ------------------------- */
  const lastGeocodedAddress = useRef<string>("");

  /* -------------------------
     Обработка ввода текста
     Handle text input
     
     CRITICAL UX RULE:
     Address change = new location selection session
     Previous marker adjustments must NOT persist across different addresses.
  ------------------------- */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setAddress((prev) => ({ ...prev, [name]: value }));

    // Если пользователь меняет адрес — полный сброс location state
    // If user changes address — full reset of location state
    setIsAddressConfirmed(false);
    setMarkerWasDragged(false);  // CRITICAL: Allow geocoding to run again
    setLocationSource("geocode");
    setConfirmedLocation(null);
    
    // Clear geocoding cache to ensure new address triggers fresh geocoding
    // This prevents stale coordinates when user edits the address
    lastGeocodedAddress.current = "";
    
    // Note: buildingType is NOT reset when address changes
    // since building type is selected BEFORE address
    // Note: coords are NOT immediately cleared - they will be updated by geocoding
    // when the new full address is valid
  };

  /* -------------------------
     Обработка перетаскивания маркера
     Handle marker drag - CRITICAL: marker position becomes source of truth
  ------------------------- */
  const handleMarkerDrag = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    setLocationSource("user_marker");
    setMarkerWasDragged(true);
    setIsAddressConfirmed(false); // требуется повторное подтверждение
    setConfirmedLocation(null);
  }, []);

  /* -------------------------
     Полный текстовый адрес
     Full address string
  ------------------------- */
  const fullAddress =
    address.strasse.trim() &&
    address.hausnummer.trim() &&
    address.plz.trim() &&
    address.ort.trim()
      ? `${address.strasse} ${address.hausnummer}, ${address.plz} ${address.ort}, Deutschland`
      : "";

  /* -------------------------
     Геокодинг — превращаем текст в координаты
     Geocoding — convert address text into coordinates
     
     CRITICAL RULE:
     - Do NOT geocode if marker was manually dragged (user_marker is source of truth)
     - Do NOT re-geocode the same address
     - Only geocode for initial address lookup
  ------------------------- */
  useEffect(() => {
    // Не геокодим, если адрес пустой
    // Skip if address is empty
    if (!fullAddress) return;

    // CRITICAL: Не перезаписываем координаты, если маркер был перетянут
    // CRITICAL: Do NOT override coordinates if marker was dragged
    if (markerWasDragged) {
      return;
    }

    // Не геокодим повторно один и тот же адрес
    // Skip if this address was already geocoded
    if (lastGeocodedAddress.current === fullAddress) {
      return;
    }

    async function geocode() {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        fullAddress
      )}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.results?.[0]) {
        const loc = data.results[0].geometry.location;

        // Запоминаем, что этот адрес уже геокодирован
        // Remember this address was geocoded
        lastGeocodedAddress.current = fullAddress;

        // Устанавливаем координаты в state (только если маркер не был перетянут)
        // Set coordinates to state (only if marker wasn't dragged)
        if (!markerWasDragged) {
          setCoords({ lat: loc.lat, lng: loc.lng });
          setLocationSource("geocode");
          setIsAddressConfirmed(false);
        }
      }
    }

    geocode();
  }, [fullAddress, markerWasDragged]);

  /* -------------------------
     Можно продолжать, если:
     - координаты найдены
     - пользователь подтвердил адрес
     Continue only if:
     - coordinates exist
     - user confirmed the address
  ------------------------- */
  const canContinueFromAddress = !!coords && isAddressConfirmed;

  /* -------------------------
     Обработка выбора типа здания и перехода к адресу
     Handle building type selection and transition to address step
     
     CRITICAL RULE:
     Only supported building types (EINFAMILIENHAUS) can proceed to address
  ------------------------- */
  const handleBuildingTypeConfirmed = () => {
    if (!buildingType || !isBuildingTypeSupported(buildingType)) {
      console.error("[PVNavigator] Cannot proceed: unsupported building type");
      return;
    }

    console.log("[PVNavigator] Building type confirmed:", buildingType);

    // Move to address step
    setCurrentStep("address");
  };

  /* -------------------------
     Обработка возврата к выбору типа здания
     Handle going back to building type step
  ------------------------- */
  const handleBackToBuildingType = () => {
    setCurrentStep("building_type");
    // Keep building type selection but allow re-selection if needed
  };

  /* -------------------------
     Обработка подтверждения адреса и запуска анализа
     Handle address confirmation and start analysis
     
     CRITICAL RULE:
     No roof geometry extraction may run unless:
     - buildingType === "EINFAMILIENHAUS"
     - Location is confirmed
  ------------------------- */
  const handleAddressConfirmedAndStartAnalysis = () => {
    if (!canContinueFromAddress || !coords) return;

    if (!buildingType || !isBuildingTypeSupported(buildingType)) {
      console.error("[PVNavigator] Cannot start analysis: unsupported building type");
      return;
    }

    // CRITICAL: Create confirmed location from MARKER position only
    // This marks the end of the address-selection phase
    // From this point: no re-geocoding, no autocomplete overrides
    const finalLocation = createConfirmedLocation(coords);
    setConfirmedLocation(finalLocation);

    console.log("[PVNavigator] Location confirmed & analysis starting:", {
      buildingType,
      coordinates: finalLocation.coordinates,
      source: finalLocation.source,
      confirmed: finalLocation.confirmed,
      confirmedAt: finalLocation.confirmedAt,
    });

    // Move to analysing step
    setCurrentStep("analysing");

    // TODO: Trigger actual roof analysis pipeline
    // This is where DOM tile fetching and roof geometry extraction would begin
  };

  /* -------------------------
     RENDER: Step-based content
  ------------------------- */
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* =========== STEP 1: BUILDING TYPE SELECTION =========== */}
        {currentStep === "building_type" && (
          <BuildingTypeSelector
            selectedType={buildingType}
            onSelect={setBuildingType}
            onContinue={handleBuildingTypeConfirmed}
            isFirstStep={true}
          />
        )}

        {/* =========== STEP 2: ADDRESS INPUT =========== */}
        {currentStep === "address" && (
          <>
            {/* HEADER */}
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-sky-400">
                Schritt 2 von 3
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold">
                Adresse eingeben und Haus bestätigen
              </h1>
              <p className="text-sm text-slate-300">
                Bitte geben Sie die Adresse des Hauses ein, auf dem die
                Photovoltaik-Anlage geplant ist. Rechts sehen Sie die Position
                auf der Karte und bestätigen, ob es sich um Ihr Haus handelt.
              </p>
            </header>

            {/* GRID: LEFT FORM + RIGHT MAP */}
            <section className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
              
              {/* ----------- LEFT: ADDRESS FORM ----------- */}
              <div className="space-y-4">
                {/* PLZ */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    Postleitzahl *
                  </label>
                  <input
                    name="plz"
                    value={address.plz}
                    onChange={handleChange}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                    placeholder="z.B. 80331"
                  />
                </div>

                {/* Ort */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    Ort *
                  </label>
                  <input
                    name="ort"
                    value={address.ort}
                    onChange={handleChange}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                    placeholder="z.B. München"
                  />
                </div>

                {/* Straße */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    Straße *
                  </label>
                  <input
                    name="strasse"
                    value={address.strasse}
                    onChange={handleChange}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                    placeholder="z.B. Musterstraße"
                  />
                </div>

                {/* Hausnummer */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    Hausnummer *
                  </label>
                  <input
                    name="hausnummer"
                    value={address.hausnummer}
                    onChange={handleChange}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                    placeholder="z.B. 12a"
                  />
                </div>
              </div>

              {/* ----------- RIGHT: DRAGGABLE MAP ----------- */}
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  Auf der Karte sehen Sie die Position, die zu Ihrer Adresse passt.
                  Bitte prüfen Sie, ob der Marker auf Ihrem Haus liegt.  
                  Falls nicht — verschieben Sie ihn auf Ihr Dach.
                </p>

                {/* MAP AREA */}
                <div className="relative w-full rounded-xl border border-slate-700 bg-slate-900/60 h-64 overflow-hidden">
                  {coords ? (
                    <DraggableMap
                      initialCenter={coords}
                      onLocationSelect={handleMarkerDrag}
                      lockMarkerPosition={markerWasDragged}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm text-center px-4">
                      Bitte geben Sie zuerst Ihre vollständige Adresse ein.
                    </div>
                  )}
                </div>

                {/* LOCATION SOURCE INDICATOR */}
                {coords && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
                      locationSource === "user_marker" 
                        ? "bg-emerald-900/50 text-emerald-300" 
                        : "bg-amber-900/50 text-amber-300"
                    }`}>
                      {locationSource === "user_marker" ? (
                        <>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Marker manuell angepasst
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          Automatisch aus Adresse
                        </>
                      )}
                    </span>
                    <span className="text-slate-500">
                      {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                    </span>
                  </div>
                )}

                {/* CONFIRMATION CHECKBOX */}
                <div className="flex items-center gap-2">
                  <input
                    id="confirm-house"
                    type="checkbox"
                    checked={isAddressConfirmed}
                    onChange={(e) => setIsAddressConfirmed(e.target.checked)}
                    disabled={!coords}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500"
                  />
                  <label htmlFor="confirm-house" className="text-sm text-slate-200">
                    Ja, das ist mein Haus / meine Dachfläche.
                  </label>
                </div>

                <p className="text-xs text-slate-500">
                  Im nächsten Schritt analysieren wir Ihr Dach automatisch.
                </p>
              </div>
            </section>

            {/* ----------- FOOTER BUTTON ----------- */}
            <footer className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                onClick={handleBackToBuildingType}
                className="px-4 py-2 rounded-full text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                ← Zurück
              </button>

              <div className="flex items-center gap-4">
                <p className="text-xs text-slate-500 max-w-xs hidden sm:block">
                  * Pflichtfelder
                </p>

                <button
                  disabled={!canContinueFromAddress}
                  className={`px-6 py-2 rounded-full text-sm font-semibold ${
                    canContinueFromAddress
                      ? "bg-sky-500 hover:bg-sky-400"
                      : "bg-slate-700 text-slate-400 cursor-not-allowed"
                  }`}
                  onClick={handleAddressConfirmedAndStartAnalysis}
                >
                  Weiter
                </button>
              </div>
            </footer>
          </>
        )}

        {/* =========== STEP 3: ANALYSING =========== */}
        {currentStep === "analysing" && (
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            {/* Loading spinner */}
            <div className="relative">
              <div className="w-16 h-16 border-4 border-slate-700 rounded-full"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-sky-500 rounded-full border-t-transparent animate-spin"></div>
            </div>

            {/* Loading text */}
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-slate-100">
                Wir analysieren Ihr Dach…
              </h2>
              <p className="text-sm text-slate-400 max-w-md">
                Dies kann einen Moment dauern. Wir erfassen die Dachgeometrie und berechnen das Solarpotenzial.
              </p>
            </div>

            {/* Progress indicator (placeholder) */}
            <div className="w-full max-w-xs bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-sky-500 rounded-full animate-pulse" style={{ width: "30%" }}></div>
            </div>

            {/* Debug info in dev mode */}
            {process.env.NODE_ENV === "development" && (
              <div className="mt-8 p-4 bg-slate-900/80 border border-slate-700 rounded-lg text-xs font-mono text-slate-400">
                <div className="text-amber-400 mb-2">🔧 DEBUG — Analysis Started</div>
                <div>Building Type: {buildingType}</div>
                <div>Location: {confirmedLocation?.coordinates.lat.toFixed(6)}, {confirmedLocation?.coordinates.lng.toFixed(6)}</div>
                <div className="mt-2 text-slate-500">TODO: Implement roof analysis pipeline</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----------- DEBUG PANEL (Development Only) ----------- */}
      {/* Debug panel temporarily disabled for UX review. Set SHOW_DEBUG_PANEL = true to re-enable. */}
      {SHOW_DEBUG_PANEL && (
        <DebugLocationPanel
          coords={coords}
          locationSource={locationSource}
          markerWasDragged={markerWasDragged}
          isAddressConfirmed={isAddressConfirmed}
          confirmedLocation={confirmedLocation}
          buildingType={buildingType}
          currentStep={currentStep}
        />
      )}
    </main>
  );
}
