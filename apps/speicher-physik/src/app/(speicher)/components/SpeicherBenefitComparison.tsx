import { formatQuantityWithUnit } from "@/lib/formatQuantityDe";
import {
  buildSpeicherBenefitComparison,
  type SpeicherBenefitComparisonInput,
} from "@/lib/speicherBenefitComparison";

const PLACEHOLDER = "—";

function formatKwhLabel(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return formatQuantityWithUnit(value, "kWh", 0);
}

function formatPctLabel(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return formatQuantityWithUnit(value, "%");
}

function ScenarioValue({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 text-sm leading-snug text-ink">{label}</span>
      <span
        className={
          emphasized
            ? "sg-speicher-value shrink-0 whitespace-nowrap text-right font-mono text-xl font-semibold tabular-nums leading-none text-accent-text"
            : "sg-speicher-value shrink-0 whitespace-nowrap text-right font-mono text-base font-medium tabular-nums leading-none text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}

function EnergyBar({ fillPercent }: { fillPercent: number | null }) {
  if (fillPercent === null) {
    return (
      <div
        className="mt-2 h-2.5 w-full rounded-[2px] border border-line bg-transparent"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="sg-speicher-bar mt-2 h-2.5 w-full overflow-hidden rounded-[2px] bg-transparent"
      aria-hidden="true"
      data-fill={String(fillPercent)}
    >
      {fillPercent > 0 ? (
        <div className="h-full bg-accent" style={{ width: `${fillPercent}%` }} />
      ) : null}
    </div>
  );
}

function AutarkieBar({ solarPercent }: { solarPercent: number | null }) {
  if (solarPercent === null) {
    return (
      <div
        className="mt-2 h-2.5 w-full rounded-[2px] border border-line bg-transparent"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="sg-speicher-bar mt-2 flex h-2.5 w-full overflow-hidden rounded-[2px] bg-chart-grid"
      aria-hidden="true"
      data-solar={String(solarPercent)}
    >
      {solarPercent > 0 ? (
        <div
          className="h-full shrink-0 bg-accent"
          style={{ width: `${solarPercent}%` }}
        />
      ) : null}
    </div>
  );
}

export function SpeicherBenefitComparison(input: SpeicherBenefitComparisonInput) {
  const model = buildSpeicherBenefitComparison(input);
  const scaleEnd =
    model.scaleMaxKwh === null
      ? PLACEHOLDER
      : formatQuantityWithUnit(model.scaleMaxKwh, "kWh/Jahr");
  const gainLabel =
    model.gainKwhRounded === null
      ? `${PLACEHOLDER} kWh`
      : formatQuantityWithUnit(model.gainKwhRounded, "kWh");
  const gridLabel =
    model.gridShareWithStorageRoundedPct === null
      ? `${PLACEHOLDER} %`
      : formatQuantityWithUnit(model.gridShareWithStorageRoundedPct, "%");

  return (
    <section className="sg-speicher-nutzen min-w-0 max-w-full" aria-labelledby="speicher-nutzen-heading">
      <h3
        id="speicher-nutzen-heading"
        className="font-sans text-[1.375rem] font-bold leading-[1.15] tracking-[-0.01em] text-ink sm:text-[1.5rem]"
      >
        Was bringt Ihnen der Speicher?
      </h3>

      <div className="sg-speicher-nutzen-grid mt-6 grid min-w-0 grid-cols-1 gap-y-8 lg:grid-cols-2 lg:gap-x-12">
        <div className="min-w-0">
          <h4 className="font-sans text-lg font-semibold leading-snug text-ink">
            Mehr Solarstrom selbst nutzen
          </h4>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
            Eigenverbrauch: Solarstrom, den Ihr Haushalt direkt oder über den
            Speicher nutzt.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <ScenarioValue
                label="Ohne Speicher"
                value={formatKwhLabel(model.ohne.raw)}
              />
              <EnergyBar fillPercent={model.ohne.fillPercent} />
            </div>
            <div>
              <ScenarioValue
                label="Mit Speicher"
                value={formatKwhLabel(model.mit.raw)}
                emphasized
              />
              <EnergyBar fillPercent={model.mit.fillPercent} />
            </div>
          </div>

          <p className="mt-1.5 flex items-baseline justify-between gap-3 font-mono text-[11px] tabular-nums text-ink-muted">
            <span>0</span>
            <span className="whitespace-nowrap text-right">{scaleEnd}</span>
          </p>

          <p className="sg-speicher-callout mt-4 rounded-sm bg-accent-soft px-3.5 py-3 text-sm font-medium leading-snug text-ink">
            Rund {gainLabel} mehr selbst genutzt / Jahr
          </p>
        </div>

        <div className="min-w-0">
          <h4 className="font-sans text-lg font-semibold leading-snug text-ink">
            Weniger Strom aus dem Netz
          </h4>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
            Autarkie: Anteil Ihres Strombedarfs, den Ihre PV-Anlage deckt.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <ScenarioValue
                label="Ohne Speicher"
                value={formatPctLabel(model.autarkieOhne.displayPct)}
              />
              <AutarkieBar solarPercent={model.autarkieOhne.solarPercent} />
            </div>
            <div>
              <ScenarioValue
                label="Mit Speicher"
                value={formatPctLabel(model.autarkieMit.displayPct)}
                emphasized
              />
              <AutarkieBar solarPercent={model.autarkieMit.solarPercent} />
            </div>
          </div>

          <p className="mt-1.5 flex items-baseline justify-between gap-3 font-mono text-[11px] tabular-nums text-ink-muted">
            <span>{formatQuantityWithUnit(0, "%")}</span>
            <span className="whitespace-nowrap text-right">
              {formatQuantityWithUnit(100, "%")} Ihres Strombedarfs
            </span>
          </p>

          <p className="sg-speicher-callout mt-4 rounded-sm bg-accent-soft px-3.5 py-3 text-sm font-medium leading-snug text-ink">
            Rund {gridLabel} kommen noch aus dem Netz
          </p>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-secondary">
            <li className="flex items-center gap-1.5">
              <span
                className="sg-speicher-swatch h-2.5 w-2.5 shrink-0 rounded-[2px] bg-accent"
                aria-hidden="true"
              />
              Eigener Solarstrom
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="sg-speicher-swatch h-2.5 w-2.5 shrink-0 rounded-[2px] bg-chart-grid"
                aria-hidden="true"
              />
              Netzstrom
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
