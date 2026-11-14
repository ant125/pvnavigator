"use client";

import { useState } from "react";
import { calculationResultHref, formatListingDate, formatListingKwh, formatListingKwP, productLabel, groupCalculations, heatPumpSummary, evSummary, type CalculationListRow } from "@/lib/calculationsList";

export function CalculationsEmptyState({ calculateUrl }: { calculateUrl: string }) {
  return (
    <div className={`hub-empty hub-history-row`}>
      <p className="text-sm font-medium text-[#0F172A]">
        Noch keine Berechnungen vorhanden.
      </p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#64748B]">
        Starten Sie Ihre erste Speicheranalyse. Abgeschlossene Berechnungen finden Sie anschließend hier.
      </p>
      <a href={calculateUrl} className={`hub-text-link mt-6`}>
        Erste Berechnung starten →
      </a>
    </div>
  );
}


export function CalculationsHistory({ rows }: { rows: CalculationListRow[] }) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const groups = groupCalculations(rows, query);
  const addressCount = groups.reduce((n, group) => n + group.addresses.length, 0);
  return <div className="hub-grouped-history">
    <div className="hub-search">
      <label htmlFor="calculation-search">Adresse oder Berechnung suchen</label>
      <input id="calculation-search" type="search" className="hub-input" placeholder="Straße, Ort, PLZ oder Bezeichnung" value={query} onChange={e => {setQuery(e.target.value);setVisibleCount(20);}}/>
      <p role="status">{addressCount} {addressCount === 1 ? "Objekt" : "Objekte"} · Nach letzter Aktualisierung</p>
    </div>
    {groups.length === 0 && <p className="hub-notice">Keine passenden Berechnungen gefunden. Ändern Sie den Suchbegriff.</p>}
    {groups.map(service => <section className="hub-service" key={service.productKey} aria-label={productLabel(service.productKey)}>
      <div className="hub-service-heading"><h3>{productLabel(service.productKey)}</h3><span>{service.addresses.length} {service.addresses.length === 1 ? "Adresse" : "Adressen"}</span></div>
      {service.addresses.slice(0, visibleCount).map((address, index) => <details className="hub-address" key={`${address.key}:${query}`} open={query.trim() ? true : index === 0}>
        <summary><span className="hub-expand" aria-hidden="true"/><strong>{address.label}</strong><span className="hub-address-count">{address.rows.length} {address.rows.length === 1 ? "Berechnung" : "Berechnungen"}</span></summary>
        <ul className="hub-variants">{address.rows.map((row, i) => {
          const href = calculationResultHref(row);
          const equipmentName = row.product_key === "speicher_grenze" && typeof row.heat_pump_enabled === "boolean" && typeof row.ev_enabled === "boolean"
            ? ["Haushalt", row.heat_pump_enabled && "Wärmepumpe", row.ev_enabled && "Elektroauto"].filter(Boolean).join(" + ") : null;
          const customName = row.name && row.name !== row.summary_address && row.name.toLowerCase() !== productLabel(row.product_key).toLowerCase();
          return <li key={row.id} className="hub-variant">
            <div className="hub-variant-heading"><div><strong>{customName ? row.name : equipmentName ?? `Berechnung vom ${formatListingDate(row.created_at)}`}</strong><span className="hub-report-ref">{i === 0 ? "Zuletzt aktualisiert" : "Aktualisiert"}: {formatListingDate(row.updated_at)} · {new Intl.DateTimeFormat("de-DE", {hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}).format(new Date(row.updated_at))}</span></div><span className="hub-status">Abgeschlossen</span></div>
            <dl className="hub-variant-data"><div><dt>PV-Anlage</dt><dd>{formatListingKwP(row.summary_pv_kwp) ?? "Nicht gespeichert"}</dd></div><div><dt>Hausverbrauch</dt><dd>{formatListingKwh(row.summary_consumption_kwh) ?? "Nicht gespeichert"}</dd></div>
            {row.product_key === "speicher_grenze" && <><div><dt>Wärmepumpe</dt><dd>{heatPumpSummary(row)}</dd></div><div><dt>Elektroauto</dt><dd>{evSummary(row)}</dd></div></>}
            <div className="hub-report-action">{href ? <a className="hub-text-link" href={href}>Bericht ansehen →</a> : <span>Berichtzugriff noch nicht verfügbar</span>}</div></dl>
          </li>;
        })}</ul>
      </details>)}
    </section>)}
    {groups.some(group => group.addresses.length > visibleCount) && <button type="button" className="hub-secondary hub-more" onClick={() => setVisibleCount(n => n + 20)}>Weitere Adressen anzeigen</button>}
  </div>;
}
