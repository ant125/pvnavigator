import Link from "next/link";
import {
  Activity,
  BatteryMedium,
  CloudSun,
  FlaskConical,
  Timer,
  type LucideIcon,
} from "lucide-react";
import {
  getPublicMethodologySections,
  METHODOLOGY_PRINCIPLES,
  PUBLIC_METHODOLOGY_INTRO,
  PUBLIC_METHODOLOGY_VERSIONING,
  type PublicMethodologySectionIcon,
} from "@pv-methodology/registry";

export const metadata = {
  title: "Methodik & Quellen | PVNavigator",
  description:
    "Datenquellen und methodische Annahmen der Berechnungen von PVNavigator.",
};

const SECTION_ICONS: Record<PublicMethodologySectionIcon, LucideIcon> = {
  weather: CloudSun,
  load: Activity,
  simulation: Timer,
  capacity: BatteryMedium,
  research: FlaskConical,
};

/**
 * Methodik & Quellen — public documentation page.
 * Content and URLs come from the central methodology registry via the
 * public presentation layer. No hardcoded official source URLs.
 */
export default function MethodikQuellenPage() {
  const sections = getPublicMethodologySections();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-ink">
      <p className="text-sm text-ink-muted mb-2">
        <Link
          href="/technische-details"
          className="text-ink-secondary hover:text-ink transition-colors"
        >
          ← Technische Details
        </Link>
      </p>

      <h1 className="text-3xl font-semibold tracking-tight text-ink mb-3">
        Methodik & Quellen
      </h1>

      <div className="mb-10 space-y-3">
        <p className="text-lg font-semibold tracking-tight text-ink">
          {PUBLIC_METHODOLOGY_INTRO.headline}
        </p>
        {PUBLIC_METHODOLOGY_INTRO.paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="text-base leading-relaxed text-ink-secondary"
          >
            {paragraph}
          </p>
        ))}
      </div>

      <section className="mb-12" aria-labelledby="grundsaetze-heading">
        <h2
          id="grundsaetze-heading"
          className="text-xl font-semibold text-ink mb-4"
        >
          Unsere Grundsätze
        </h2>
        <ul className="space-y-3">
          {METHODOLOGY_PRINCIPLES.map((principle) => (
            <li
              key={principle}
              className="flex items-start gap-3 text-base leading-relaxed text-ink"
            >
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                aria-hidden
              />
              <span>{principle}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-12">
        {sections.map((section) => {
          const Icon = SECTION_ICONS[section.icon];
          return (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-heading`}
            >
              <h2
                id={`${section.id}-heading`}
                className="flex items-center gap-2.5 text-xl font-semibold text-ink mb-2"
              >
                <Icon
                  className="h-5 w-5 shrink-0 text-ink-muted"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span>{section.title}</span>
              </h2>
              <p className="text-sm leading-relaxed text-ink-secondary mb-5">
                {section.description}
              </p>

              <ul className="space-y-4">
                {section.entries.map((entry) => (
                  <li
                    key={entry.id}
                    id={entry.id}
                    className="border border-line rounded-lg px-4 py-4 bg-surface"
                  >
                    <h3 className="text-base font-semibold text-ink mb-1">
                      {entry.title}
                    </h3>
                    {entry.organization ? (
                      <p className="text-sm text-ink-secondary mb-2">
                        {entry.organization}
                      </p>
                    ) : null}
                    <p className="text-sm leading-relaxed text-ink mb-3">
                      {entry.description}
                    </p>
                    {entry.bullets.length > 0 ? (
                      <ul className="mb-3 space-y-1.5">
                        {entry.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            className="flex items-start gap-2 text-sm leading-relaxed text-ink-secondary"
                          >
                            <span className="text-ink-muted mt-0.5" aria-hidden>
                              •
                            </span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {entry.links.length > 0 ? (
                      <ul className="space-y-1.5">
                        {entry.links.map((link) => (
                          <li key={link.sourceId}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                            >
                              {link.label} ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <aside
        className="mt-14 border-t border-line pt-6"
        aria-labelledby="versionierung-heading"
      >
        <h2
          id="versionierung-heading"
          className="text-sm font-semibold text-ink mb-2"
        >
          {PUBLIC_METHODOLOGY_VERSIONING.title}
        </h2>
        <div className="space-y-2">
          {PUBLIC_METHODOLOGY_VERSIONING.paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className="text-xs leading-relaxed text-ink-muted"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </aside>
    </div>
  );
}
