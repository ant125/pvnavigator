"use client";

import { useEffect, useState } from "react";
import DraggableMap from "../components/DraggableMapComponent";

/* -------------------------
   Типы данных адреса
   Address form types
------------------------- */
type AddressForm = {
  plz: string;
  ort: string;
  strasse: string;
  hausnummer: string;
};

export default function AnalysePage() {
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
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  /* -------------------------
     Подтверждение адреса пользователем
     User confirmation checkbox
  ------------------------- */
  const [isAddressConfirmed, setIsAddressConfirmed] = useState(false);

  /* -------------------------
     Обработка ввода текста
     Handle text input
  ------------------------- */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setAddress((prev) => ({ ...prev, [name]: value }));

    // Если пользователь меняет адрес — галочка снимается
    // If user changes address — confirmation is reset
    setIsAddressConfirmed(false);
  };

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
  ------------------------- */
  useEffect(() => {
    if (!fullAddress) return;

    async function geocode() {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        fullAddress
      )}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.results?.[0]) {
        const loc = data.results[0].geometry.location;

        // Устанавливаем координаты в state
        // Set coordinates to state
        setCoords({ lat: loc.lat, lng: loc.lng });

        // Сбрасываем подтверждение — адрес изменился
        // Reset confirmation — address has changed
        setIsAddressConfirmed(false);
      }
    }

    geocode();
  }, [fullAddress]);

  /* -------------------------
     Можно продолжать, если:
     - координаты найдены
     - пользователь подтвердил адрес
     Continue only if:
     - coordinates exist
     - user confirmed the address
  ------------------------- */
  const canContinue = !!coords && isAddressConfirmed;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* HEADER */}
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-sky-400">
            Schritt 1 von X
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
                  onLocationSelect={(lat, lng) => {
                    setCoords({ lat, lng });
                    setIsAddressConfirmed(false); // любое движение маркера → нужно подтвердить снова
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm text-center px-4">
                  Bitte geben Sie zuerst Ihre vollständige Adresse ein.
                </div>
              )}
            </div>

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
              Im nächsten Schritt können Sie Fotos Ihres Hauses hochladen.
            </p>
          </div>
        </section>

        {/* ----------- FOOTER BUTTON ----------- */}
        <footer className="flex justify-between items-center pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 max-w-md">
            * Pflichtfelder – Ihre Adresse wird ausschließlich für die Dachanalyse verwendet.
          </p>

          <button
            disabled={!canContinue}
            className={`px-6 py-2 rounded-full text-sm font-semibold ${
              canContinue
                ? "bg-sky-500 hover:bg-sky-400"
                : "bg-slate-700 text-slate-400 cursor-not-allowed"
            }`}
            onClick={() => {
              if (canContinue) {
                alert(
                  "Adresse bestätigt. Im nächsten Schritt erfassen wir Dach- und Verbrauchsdaten."
                );
              }
            }}
          >
            Weiter
          </button>
        </footer>
      </div>
    </main>
  );
}