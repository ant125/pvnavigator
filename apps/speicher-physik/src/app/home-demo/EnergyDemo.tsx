"use client";
import { useState } from "react";
import { DEMO, simulateDay, timeLabel, type Season } from "./model";
const fmt = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function EnergyDemo() {
  const [season, setSeason] = useState<Season>("summer");
  const [index, setIndex] = useState(48);
  const rows = simulateDay(season);
  const row = rows[index];
  const x = (i: number) => 48 + i*9;
  const y = (v: number) => 230-v*26;
  const path = rows.map((r,i) => `${i ? "L" : "M"}${x(i)},${y(r.load)} H${x(i+1)}`).join(" ");
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
      <p className="text-sm text-ink-secondary">Modellbeispiel · 24 Stunden · 96 Intervalle</p>
      <div className="inline-flex gap-1 rounded-sm border border-line bg-surface-muted p-1" role="group" aria-label="Beispieltag">
        {([['summer','Sommertag'],['winter','Wintertag']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={season===value} onClick={()=>setSeason(value)} className={`min-h-11 rounded-sm border px-3 text-sm transition-colors ${season===value ? 'border-line-strong bg-surface font-semibold text-ink shadow-sm' : 'border-transparent bg-transparent text-ink-secondary hover:bg-surface/60'}`}>{label}</button>)}
      </div>
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 pt-4 text-xs" aria-label="Legende">
      <span><b className="text-warning">▥</b> PV-Erzeugung</span><span><b>━</b> Verbrauch (Stufen)</span>
      <span className="text-accent">▴ Batterie laden</span><span className="text-warning">▾ Batterie entladen</span>
    </div>
    <div className="overflow-x-auto p-2 sm:p-4" tabIndex={0} role="region" aria-label="Tagesprofil, auf kleinen Bildschirmen horizontal scrollbar">
      <svg viewBox="0 0 940 370" className="h-auto w-full min-w-[640px]" role="img" aria-label={`${season==='summer'?'Sommer':'Winter'}tag: PV und Verbrauch oben, Batterieleistung unten. Werte des ausgewählten Intervalls stehen unter dem Diagramm.`}>
        <text x="8" y="20" fill="var(--color-chart-axis)" fontSize="12">kW</text>
        {[0,2,4,6,8].map(v=><g key={v}><line x1="48" x2="912" y1={y(v)} y2={y(v)} stroke="var(--color-chart-grid)"/><text x="28" y={y(v)+4} fontSize="11" fill="var(--color-chart-axis)">{v}</text></g>)}
        <rect x={x(index)} y="22" width="9" height="313" fill="var(--color-accent-soft)"/>
        {rows.map((r,i)=><rect key={i} x={x(i)+1} y={y(r.pv)} width="7" height={230-y(r.pv)} fill="var(--color-warning)" opacity="0.65"/>)}
        <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth="2"/>
        <text x="48" y="258" fill="var(--color-chart-axis)" fontSize="11">Batterie · + Laden / − Entladen · max. 3 kW</text>
        <line x1="48" x2="912" y1="300" y2="300" stroke="var(--color-line-strong)"/>
        {rows.map((r,i)=><rect key={i} x={x(i)+1} y={300-r.charge*10} width="7" height={(r.charge+r.discharge)*10} fill={r.charge>0?'var(--color-accent)':'var(--color-warning)'}/>)}
        <line x1={x(index)+4.5} x2={x(index)+4.5} y1="22" y2="335" stroke="var(--color-accent)" strokeDasharray="3 3"/>
        {[0,4,8,12,16,20,24].map(h=><text key={h} x={x(h*4)} y="357" textAnchor="middle" fontSize="12" fill="var(--color-chart-axis)">{String(h).padStart(2,'0')}:00</text>)}
      </svg>
    </div>
    <div className="border-t border-line p-4">
      <label htmlFor="demo-time" className="flex flex-wrap justify-between gap-2 text-sm"><span>Intervall auswählen · 15 Minuten</span><strong className="font-mono">{timeLabel(index)}–{timeLabel(index+1)}</strong></label>
      <input id="demo-time" className="my-4 h-6 w-full accent-accent" type="range" min="0" max="95" step="1" value={index} aria-valuetext={`${timeLabel(index)} bis ${timeLabel(index+1)}`} onChange={e=>setIndex(Number(e.target.value))}/>
      <dl className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4" aria-live="polite">
        {[["PV",`${fmt(row.pv)} kW`],["Verbrauch",`${fmt(row.load)} kW`],[row.charge>0?'Batterie · Laden':row.discharge>0?'Batterie · Entladen':'Batterie · Ruhe',`${fmt(row.charge+row.discharge)} kW`],["SOC · Intervallende",`${fmt(row.soc)} %`]].map(([label,value])=><div key={label} className="bg-surface p-3"><dt className="text-xs text-ink-secondary">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd></div>)}
      </dl>
      <p className="mt-3 text-xs text-ink-secondary">Netzbezug: {fmt(row.imported)} kW · Einspeisung: {fmt(row.exported)} kW. PV versorgt zuerst den Haushalt. Überschuss lädt den Speicher; bei Defizit entlädt er sich.</p>
      <details className="mt-4 border-t border-line pt-3 text-xs text-ink-secondary"><summary className="cursor-pointer py-1 font-semibold text-ink">Annahmen des Modellbeispiels</summary><p className="mt-2 leading-relaxed">Frei gewählte Beispielprofile, keine PVGIS-Ergebnisse und keine individuelle Berechnung. Nutzbare Kapazität {DEMO.capacity} kWh; Lade- und Entladeleistung maximal {DEMO.power} kW; Wirkungsgrad je Richtung 95 %. Anfangsladung 2 kWh (25 %) für beide Tage. SOC gilt am Ende des Intervalls. Keine Netzladung; Restmengen gehen ins Netz oder kommen aus dem Netz. Jeder Zeitschritt entspricht 0,25 Stunden.</p></details>
    </div>
  </>;
}
