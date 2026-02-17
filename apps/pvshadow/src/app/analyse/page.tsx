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
import { isInsideBavaria, getBavariaCheckResult } from "../utils/bavaria";

/**
 * Debug panel visibility flag
 * 
 * Set to true to enable debug panel for development verification.
 * Currently disabled for cleaner UX testing.
 */
const SHOW_DEBUG_PANEL = false;

/**
 * Analysis flow steps
 * 
 * FLOW ORDER:
 * 1. building_type — User selects building type (hard gate for MVP)
 * 2. address — Address input + Satellite view (find the house)
 * 3. coordinate_validation — Confirm marker on Map view (source of truth)
 * 4. analysing — Automatic analysis (DOM, roof, PV)
 */
type AnalysisStep = "building_type" | "address" | "coordinate_validation" | "analysing";

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
     Ошибка валидации Bavaria
     Bavaria validation error state
  ------------------------- */
  const [bavariaError, setBavariaError] = useState<boolean>(false);

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
    setBavariaError(false);  // Clear Bavaria error when address changes
    
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
    setBavariaError(false); // Clear Bavaria error when user adjusts marker
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
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: fullAddress }),
      });
      const data = await res.json();

      if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
        console.error("[PVNavigator] Geocoding API error:", data.status, data.error_message);
        return;
      }

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
     Обработка подтверждения адреса и перехода к валидации координат
     Handle address confirmation and transition to coordinate validation
     
     CRITICAL: Bavaria Gate runs HERE, BEFORE coordinate_validation
     Users outside Bavaria never see the coordinate validation step
  ------------------------- */
  const handleAddressConfirmedGoToValidation = () => {
    if (!canContinueFromAddress || !coords) return;

    // CRITICAL: Bavaria Gate - validate coordinates are inside Bavaria
    // This check runs BEFORE showing coordinate validation
    const bavariaCheck = getBavariaCheckResult(coords);
    
    if (!bavariaCheck.isInside) {
      console.warn("[PVNavigator] Bavaria Gate FAILED at address step:", bavariaCheck.message);
      setBavariaError(true);
      // Do NOT proceed to coordinate_validation
      return;
    }

    console.log("[PVNavigator] Bavaria Gate PASSED, moving to coordinate validation:", {
      coordinates: coords,
      source: locationSource,
      bavariaCheck: bavariaCheck.message,
    });

    // Clear any previous Bavaria error
    setBavariaError(false);

    // Move to coordinate validation step (Map view)
    setCurrentStep("coordinate_validation");
  };

  /* -------------------------
     Обработка возврата к шагу адреса
     Handle going back to address step (from coordinate validation)
  ------------------------- */
  const handleBackToAddress = () => {
    setCurrentStep("address");
    // Note: Bavaria error already passed (users can only reach coordinate_validation if inside Bavaria)
    // Keep coordinates but clear confirmed location
    setConfirmedLocation(null);
  };

  /* -------------------------
     Обработка перетаскивания маркера на шаге валидации
     Handle marker drag on coordinate validation step
     
     Note: Bavaria Gate already passed at address step, so no need to clear Bavaria error here
  ------------------------- */
  const handleValidationMarkerDrag = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    setLocationSource("user_marker");
  }, []);

  /* -------------------------
     Обработка подтверждения координат и запуска анализа
     Handle coordinate confirmation and start analysis
     
     CRITICAL RULES:
     1. Bavaria Gate already passed (checked at address step)
     2. After confirmation, coordinates are LOCKED (immutable)
     3. No roof geometry extraction may run unless buildingType === "EINFAMILIENHAUS"
  ------------------------- */
  const handleCoordinateConfirmation = () => {
    if (!coords) return;

    if (!buildingType || !isBuildingTypeSupported(buildingType)) {
      console.error("[PVNavigator] Cannot start analysis: unsupported building type");
      return;
    }

    // Note: Bavaria Gate already passed at address step
    // Users can only reach this step if coordinates are inside Bavaria

    // CRITICAL: Create confirmed location from MARKER position only
    // This marks the end of coordinate selection
    // From this point: coordinates are IMMUTABLE
    const finalLocation = createConfirmedLocation(coords);
    setConfirmedLocation(finalLocation);

    console.log("[PVNavigator] Coordinates confirmed & analysis starting:", {
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
                Schritt 2 von 4
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold">
                Adresse eingeben und Haus finden
          </h1>
          <p className="text-sm text-slate-300">
            Bitte geben Sie die Adresse des Hauses ein, auf dem die
                Photovoltaik-Anlage geplant ist. Die Satellitenansicht hilft Ihnen,
                Ihr Haus zu finden.
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
                    onChange={(e) => {
                      setIsAddressConfirmed(e.target.checked);
                      // Clear Bavaria error when user changes confirmation
                      if (e.target.checked) setBavariaError(false);
                    }}
                disabled={!coords}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500"
              />
              <label htmlFor="confirm-house" className="text-sm text-slate-200">
                Ja, das ist mein Haus / meine Dachfläche.
              </label>
            </div>

                {/* BAVARIA ERROR MESSAGE */}
                {bavariaError && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-rose-100">
                          Außerhalb des unterstützten Gebiets
                        </p>
                        <p className="text-sm text-rose-200/70">
                          PVNavigator unterstützt derzeit nur Standorte in Bayern.
                          Bitte überprüfen Sie die Adresse oder wählen Sie einen Standort innerhalb Bayerns.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!bavariaError && (
                  <p className="text-xs text-slate-500">
                    Im nächsten Schritt bestätigen Sie die exakte Position.
            </p>
                )}
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
                  onClick={handleAddressConfirmedGoToValidation}
                >
                  Weiter
                </button>
              </div>
            </footer>
          </>
        )}

        {/* =========== STEP 3: COORDINATE VALIDATION =========== */}
        {currentStep === "coordinate_validation" && (
          <>
            {/* HEADER */}
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-sky-400">
                Schritt 3 von 4
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold">
                Position auf der Karte bestätigen
              </h1>
              <p className="text-sm text-slate-300">
                Bitte bestätigen Sie die exakte Position Ihres Hauses auf der Karte.
                Satellitenbilder können leicht versetzt sein.
              </p>
            </header>

            {/* MAP SECTION */}
            <section className="space-y-4">
              {/* MAP AREA - Road map view for precise positioning */}
              <div className="relative w-full rounded-xl border border-slate-700 bg-slate-900/60 h-80 overflow-hidden">
                {coords && (
                  <DraggableMap
                    initialCenter={coords}
                    onLocationSelect={handleValidationMarkerDrag}
                    lockMarkerPosition={false}
                    mapTypeId="roadmap"
                    disableDragging={false}
                  />
                )}
              </div>

              {/* HINT */}
              <p className="text-xs text-slate-400">
                💡 Falls nötig, können Sie den Marker noch leicht verschieben.
              </p>

              {/* COORDINATES DISPLAY */}
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-300">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  Position
                </span>
                <span className="text-slate-400 font-mono">
                  {coords?.lat.toFixed(6)}, {coords?.lng.toFixed(6)}
                </span>
              </div>

              {/* Note: Bavaria Gate already passed at address step */}
              {/* Users can only reach this step if coordinates are inside Bavaria */}
            </section>

            {/* ----------- FOOTER BUTTON ----------- */}
            <footer className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                onClick={handleBackToAddress}
                className="px-4 py-2 rounded-full text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                ← Zurück
              </button>

              <button
                disabled={!coords}
                className={`px-6 py-2 rounded-full text-sm font-semibold ${
                  coords
                    ? "bg-sky-500 hover:bg-sky-400"
                    : "bg-slate-700 text-slate-400 cursor-not-allowed"
                }`}
                onClick={handleCoordinateConfirmation}
          >
            Weiter
          </button>
        </footer>
          </>
        )}

        {/* =========== STEP 4: ANALYSING =========== */}
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
      {/* Debug panel enabled for development — positioned bottom-left for better UX. */}
      {SHOW_DEBUG_PANEL && (
        <DebugLocationPanel
          coords={coords}
          locationSource={locationSource}
          markerWasDragged={markerWasDragged}
          isAddressConfirmed={isAddressConfirmed}
          confirmedLocation={confirmedLocation}
          buildingType={buildingType}
          currentStep={currentStep}
          bavariaCheckPassed={coords ? isInsideBavaria(coords) : null}
        />
      )}
    </main>
  );
}
