"use client";

import { useState } from "react";

type AddressForm = {
  plz: string;
  ort: string;
  strasse: string;
  hausnummer: string;
};

export default function AnalysePage() {
  const [address, setAddress] = useState<AddressForm>({
    plz: "",
    ort: "",
    strasse: "",
    hausnummer: "",
  });

  const [isAddressConfirmed, setIsAddressConfirmed] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
    setIsAddressConfirmed(false); // если меняем адрес — снимаем подтверждение
  };

  // Строка адреса для карты
  const addressString =
    address.strasse.trim() &&
    address.hausnummer.trim() &&
    address.plz.trim() &&
    address.ort.trim()
      ? `${address.strasse} ${address.hausnummer}, ${address.plz} ${address.ort}, Deutschland`
      : "";

  const canContinue =
    !!addressString && isAddressConfirmed;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
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

        <section className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
          {/* ЛЕВАЯ ЧАСТЬ – ФОРМА АДРЕСА */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                Postleitzahl *
              </label>
              <input
                name="plz"
                value={address.plz}
                onChange={handleChange}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="z.B. 80331"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                Ort *
              </label>
              <input
                name="ort"
                value={address.ort}
                onChange={handleChange}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="z.B. München"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                Straße *
              </label>
              <input
                name="strasse"
                value={address.strasse}
                onChange={handleChange}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="z.B. Musterstraße"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                Hausnummer *
              </label>
              <input
                name="hausnummer"
                value={address.hausnummer}
                onChange={handleChange}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="z.B. 12a"
              />
            </div>
          </div>

          {/* ПРАВАЯ ЧАСТЬ – КАРТА + ПОДТВЕРЖДЕНИЕ */}
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Auf der Karte sehen Sie die Position, die zu Ihrer Adresse passt.
              Bitte prüfen Sie, ob der Marker auf Ihrem Haus liegt.
            </p>

            <div className="relative w-full rounded-xl border border-slate-700 bg-slate-900/60 h-64 overflow-hidden">
              {addressString ? (
                <iframe
                  title="Haus auf der Karte"
                  className="w-full h-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    addressString
                  )}&output=embed`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm px-4 text-center">
                  Bitte geben Sie zuerst Ihre vollständige Adresse ein,
                  dann wird hier die Karte mit Ihrem Haus angezeigt.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                id="confirm-house"
                type="checkbox"
                checked={isAddressConfirmed}
                onChange={(e) => setIsAddressConfirmed(e.target.checked)}
                disabled={!addressString}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500 disabled:opacity-50"
              />
              <label
                htmlFor="confirm-house"
                className="text-sm text-slate-200"
              >
                Ja, das ist mein Haus / meine Dachfläche.
              </label>
            </div>

            <p className="text-xs text-slate-500">
              Im nächsten Schritt können Sie Fotos Ihres Hauses hochladen,
              damit wir Gauben, Kamine und Dachfenster genauer bewerten können.
            </p>
          </div>
        </section>

        {/* НИЖНЯЯ ПАНЕЛЬ: Пояснение + кнопка "Weiter" */}
        <footer className="flex justify-between items-center pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 max-w-md">
            * Pflichtfelder – Ihre Adresse wird ausschließlich für die
            Dachanalyse verwendet und nicht an Dritte weitergegeben.
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
                // позже: переход на Schritt 2
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