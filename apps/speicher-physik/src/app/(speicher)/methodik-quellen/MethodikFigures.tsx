/**
 * Restrained engineering figures for the Methodik documentation.
 * Decorative only — no calculation logic.
 */

export function SimulationFigure() {
  return (
    <figure className="my-6">
      <div className="rounded-md border border-line bg-surface-muted px-4 py-4 sm:px-5">
        <svg
          viewBox="0 0 640 168"
          className="h-auto w-full"
          role="img"
          aria-labelledby="fig-sim-title"
          aria-describedby="fig-sim-desc"
        >
          <title id="fig-sim-title">
            Fünfzehn unabhängige Wetterjahre, jeweils 35.040 Viertelstunden
          </title>
          <desc id="fig-sim-desc">
            Jedes Wetterjahr wird getrennt simuliert. Innerhalb eines Jahres
            entstehen 35.040 physikalische Batterieschritte.
          </desc>
          <text
            x="0"
            y="16"
            fill="var(--color-ink-muted)"
            fontSize="11"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            15 Wetterjahre, unabhängig
          </text>
          {Array.from({ length: 15 }, (_, i) => {
            const x = 8 + i * 41;
            const h = 36 + ((i * 17) % 22);
            const y = 92 - h;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width="28"
                  height={h}
                  fill="var(--color-accent-soft)"
                  stroke="var(--color-accent)"
                  strokeWidth="1"
                />
                <text
                  x={x + 14}
                  y="108"
                  textAnchor="middle"
                  fill="var(--color-ink-muted)"
                  fontSize="9"
                  fontFamily="Arial, Helvetica, sans-serif"
                >
                  {2006 + i}
                </text>
              </g>
            );
          })}
          <text
            x="0"
            y="132"
            fill="var(--color-ink)"
            fontSize="11"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            je Jahr: 35.040 Schritte · Δt = 15 min · physikalische Batteriebilanz
          </text>
          <text
            x="0"
            y="154"
            fill="var(--color-ink-muted)"
            fontSize="11"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            keine monatliche Mittelwertbildung
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 text-xs leading-relaxed text-ink-muted">
        Jedes Wetterjahr bleibt ein eigenes Simulationsjahr. Die Kennzahlen
        entstehen erst danach aus den Jahresergebnissen.
      </figcaption>
    </figure>
  );
}

export function PvExpansionFigure() {
  return (
    <figure className="my-6">
      <div className="rounded-md border border-line bg-surface-muted px-4 py-4 sm:px-5">
        <svg
          viewBox="0 0 640 140"
          className="h-auto w-full"
          role="img"
          aria-labelledby="fig-pv-title"
          aria-describedby="fig-pv-desc"
        >
          <title id="fig-pv-title">
            Stündliche PVGIS-Energie, gleichmäßig auf vier Viertelstunden verteilt
          </title>
          <desc id="fig-pv-desc">
            Ein Stundenwert E wird konservativ in vier gleiche 15-Minuten-Energien
            E/4 aufgeteilt. Die Jahresenergie bleibt erhalten.
          </desc>
          <text
            x="0"
            y="16"
            fill="var(--color-ink-muted)"
            fontSize="11"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            PVGIS, stündlich
          </text>
          <rect
            x="8"
            y="28"
            width="200"
            height="64"
            fill="var(--color-accent-soft)"
            stroke="var(--color-accent)"
            strokeWidth="1"
          />
          <text
            x="108"
            y="65"
            textAnchor="middle"
            fill="var(--color-ink)"
            fontSize="13"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            E
          </text>
          <path
            d="M 224 60 L 268 60"
            stroke="var(--color-line-strong)"
            strokeWidth="1.5"
            markerEnd="url(#arrow)"
          />
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-line-strong)" />
            </marker>
          </defs>
          <text
            x="430"
            y="16"
            fill="var(--color-ink-muted)"
            fontSize="11"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            Simulation, 15 Minuten
          </text>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect
                x={288 + i * 84}
                y="28"
                width="72"
                height="64"
                fill="var(--color-surface)"
                stroke="var(--color-accent)"
                strokeWidth="1"
              />
              <text
                x={324 + i * 84}
                y="65"
                textAnchor="middle"
                fill="var(--color-ink)"
                fontSize="13"
                fontFamily="Arial, Helvetica, sans-serif"
              >
                E/4
              </text>
            </g>
          ))}
          <text
            x="0"
            y="122"
            fill="var(--color-ink-muted)"
            fontSize="11"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            Jahresenergie bleibt erhalten · keine intra-stündlichen Spitzen erzeugt
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 text-xs leading-relaxed text-ink-muted">
        Die Verteilung auf Viertelstunden ist energieerhaltend und konservativ:
        sie erfindet keine Erzeugungsspitzen innerhalb der Stunde.
      </figcaption>
    </figure>
  );
}

export function ValidationFigure() {
  return (
    <figure className="my-6">
      <div className="rounded-md border border-line bg-surface-muted px-4 py-5 sm:px-5">
        <svg
          viewBox="0 0 640 150"
          className="h-auto w-full"
          role="img"
          aria-labelledby="fig-val-title"
          aria-describedby="fig-val-desc"
        >
          <title id="fig-val-title">
            Validierung bei identischer PV-Anlage und identischem Batteriemodell
          </title>
          <desc id="fig-val-desc">
            PV, Batterie und Jahresverbrauch bleiben fest. Nur die Form des
            Haushaltslastgangs wechselt von BDEW H25 zu 27 gemessenen Häusern.
          </desc>
          {[
            { x: 8, label: "PV-Anlage", sub: "identisch", locked: true },
            { x: 168, label: "Batteriemodell", sub: "identisch", locked: true },
            { x: 328, label: "Jahresverbrauch", sub: "identisch", locked: true },
            { x: 488, label: "Lastgang", sub: "variiert", locked: false },
          ].map((box) => (
            <g key={box.label}>
              <rect
                x={box.x}
                y="20"
                width="144"
                height="88"
                fill={
                  box.locked
                    ? "var(--color-surface)"
                    : "var(--color-accent-soft)"
                }
                stroke={
                  box.locked
                    ? "var(--color-line)"
                    : "var(--color-accent)"
                }
                strokeWidth="1"
              />
              <text
                x={box.x + 72}
                y="54"
                textAnchor="middle"
                fill="var(--color-ink)"
                fontSize="12"
                fontFamily="Arial, Helvetica, sans-serif"
              >
                {box.label}
              </text>
              <text
                x={box.x + 72}
                y="78"
                textAnchor="middle"
                fill="var(--color-ink-muted)"
                fontSize="11"
                fontFamily="Arial, Helvetica, sans-serif"
              >
                {box.sub}
              </text>
            </g>
          ))}
          <text
            x="0"
            y="138"
            fill="var(--color-ink-muted)"
            fontSize="11"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            BDEW H25 bleibt Produktionsprofil · 27 gemessene Lastgänge nur zur Prüfung
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 text-xs leading-relaxed text-ink-muted">
        Die Validierung ersetzt BDEW nicht. Sie prüft, wie sich die Kennwerte
        ändern, wenn nur die Form des Lastgangs wechselt.
      </figcaption>
    </figure>
  );
}
