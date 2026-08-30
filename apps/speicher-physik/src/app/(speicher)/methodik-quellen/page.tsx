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
  METHODOLOGY_CHAPTERS,
  METHODOLOGY_PAGE_SUBTITLE,
  METHODOLOGY_PAGE_TITLE,
  PUBLIC_METHODOLOGY_VERSIONING,
  QUELLEN_SECTION_INTRO,
  QUELLEN_SECTION_TITLE,
  type MethodologyChapter,
  type MethodologyTable,
  type PublicMethodologySectionIcon,
} from "@pv-methodology/registry";
import {
  PvExpansionFigure,
  SimulationFigure,
  ValidationFigure,
} from "./MethodikFigures";

export const metadata = {
  title: "Methodik | PVNavigator",
  description: METHODOLOGY_PAGE_SUBTITLE,
};

const SECTION_ICONS: Record<PublicMethodologySectionIcon, LucideIcon> = {
  weather: CloudSun,
  load: Activity,
  simulation: Timer,
  capacity: BatteryMedium,
  research: FlaskConical,
};

function chapterNumber(n: number): string {
  return String(n).padStart(2, "0");
}

function ChapterFigure({
  figure,
}: {
  figure: NonNullable<MethodologyChapter["figure"]>;
}) {
  if (figure === "simulation") return <SimulationFigure />;
  if (figure === "pv-expansion") return <PvExpansionFigure />;
  return <ValidationFigure />;
}

function EngineeringTable({ table }: { table: MethodologyTable }) {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <caption className="mb-2 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
          {table.caption}
        </caption>
        <thead>
          <tr className="border-b border-line">
            {table.columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="bg-surface-muted px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-ink"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.join("|")} className="border-b border-line-soft">
              {row.map((cell, cellIndex) => {
                const isHeader = table.rowHeaders === true && cellIndex === 0;
                const Cell = isHeader ? "th" : "td";
                return (
                  <Cell
                    key={`${cell}-${cellIndex}`}
                    scope={isHeader ? "row" : undefined}
                    className={
                      isHeader
                        ? "px-3 py-2.5 text-left font-medium text-ink align-top"
                        : "px-3 py-2.5 text-ink-secondary align-top"
                    }
                  >
                    {cell}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EngineeringCallout({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <aside className="my-6 border-l-2 border-accent bg-accent-soft/60 px-4 py-3 sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink">{body}</p>
    </aside>
  );
}

function MethodikChapter({ chapter }: { chapter: MethodologyChapter }) {
  const headingId = `${chapter.id}-heading`;

  return (
    <section
      id={chapter.id}
      aria-labelledby={headingId}
      className={
        chapter.number === 1
          ? "scroll-mt-24 mt-8 border-t border-line pt-8 lg:pt-10"
          : "scroll-mt-24 border-t border-line pt-8 lg:pt-10"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {chapterNumber(chapter.number)}
      </p>
      <h2
        id={headingId}
        className="mt-1 text-xl font-semibold tracking-tight text-ink"
      >
        {chapter.title}
      </h2>

      <div className="mt-4 max-w-reading space-y-3">
        {chapter.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-base leading-relaxed text-ink-secondary">
            {paragraph}
          </p>
        ))}
      </div>

      {chapter.figure ? <ChapterFigure figure={chapter.figure} /> : null}

      {chapter.bullets && chapter.bullets.length > 0 ? (
        <ul className="mt-5 max-w-reading space-y-2">
          {chapter.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2.5 text-sm leading-relaxed text-ink"
            >
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                aria-hidden
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {chapter.tables?.map((table) => (
        <EngineeringTable key={table.caption} table={table} />
      ))}

      {chapter.callouts?.map((callout) => (
        <EngineeringCallout
          key={callout.title}
          title={callout.title}
          body={callout.body}
        />
      ))}

      {chapter.notes?.map((note) => (
        <p
          key={note}
          className="mt-4 max-w-reading text-sm leading-relaxed text-ink-muted"
        >
          {note}
        </p>
      ))}
    </section>
  );
}

/**
 * Methodik & Quellen — public engineering documentation.
 * Methodik copy lives in @pv-methodology for later PDF reuse.
 * Official URLs come only from the registry via the public presentation layer.
 */
export default function MethodikQuellenPage() {
  const sections = getPublicMethodologySections();

  return (
    <div className="max-w-frame mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-sheet rounded-lg border border-line bg-surface p-5 text-ink sm:p-8 lg:p-10">
        <header>
          <h1 id="methodik" className="scroll-mt-24 text-3xl font-semibold tracking-tight text-ink">
            {METHODOLOGY_PAGE_TITLE}
          </h1>
          <p className="mt-3 max-w-reading text-base leading-relaxed text-ink-secondary">
            {METHODOLOGY_PAGE_SUBTITLE}
          </p>
        </header>

        <nav
          aria-label="Inhalt"
          className="mt-8 border-t border-line pt-6"
        >
          <ol className="grid gap-2 sm:grid-cols-2">
            {METHODOLOGY_CHAPTERS.map((chapter) => (
              <li key={chapter.id}>
                <a
                  href={`#${chapter.id}`}
                  className="group flex items-baseline gap-2 text-sm text-ink-secondary transition-colors hover:text-ink"
                >
                  <span className="font-medium tabular-nums text-ink-muted">
                    {chapterNumber(chapter.number)}
                  </span>
                  <span className="group-hover:underline group-hover:underline-offset-2">
                    {chapter.title}
                  </span>
                </a>
              </li>
            ))}
            <li>
              <a
                href="#quellen"
                className="group flex items-baseline gap-2 text-sm text-ink-secondary transition-colors hover:text-ink"
              >
                <span className="font-medium text-ink-muted">—</span>
                <span className="group-hover:underline group-hover:underline-offset-2">
                  {QUELLEN_SECTION_TITLE}
                </span>
              </a>
            </li>
          </ol>
        </nav>

        <div>
          {METHODOLOGY_CHAPTERS.map((chapter) => (
            <MethodikChapter key={chapter.id} chapter={chapter} />
          ))}
        </div>

        <section
          id="quellen"
          aria-labelledby="quellen-heading"
          className="scroll-mt-24 mt-12 border-t border-line pt-10 lg:mt-14 lg:pt-12"
        >
          <h2
            id="quellen-heading"
            className="text-2xl font-semibold tracking-tight text-ink"
          >
            {QUELLEN_SECTION_TITLE}
          </h2>
          <p className="mt-3 max-w-reading text-base leading-relaxed text-ink-secondary">
            {QUELLEN_SECTION_INTRO}
          </p>

          <div className="mt-10 space-y-12">
            {sections.map((section) => {
              const Icon = SECTION_ICONS[section.icon];
              return (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-heading`}
                >
                  <h3
                    id={`${section.id}-heading`}
                    className="mb-2 flex items-center gap-2.5 text-xl font-semibold text-ink"
                  >
                    <Icon
                      className="h-5 w-5 shrink-0 text-ink-muted"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span>{section.title}</span>
                  </h3>
                  <p className="mb-5 text-sm leading-relaxed text-ink-secondary">
                    {section.description}
                  </p>

                  <ul className="space-y-4">
                    {section.entries.map((entry) => (
                      <li
                        key={entry.id}
                        id={entry.id}
                        className="rounded-lg border border-line bg-surface-muted px-4 py-4"
                      >
                        <h4 className="mb-1 text-base font-semibold text-ink">
                          {entry.title}
                        </h4>
                        {entry.organization ? (
                          <p className="mb-2 text-sm text-ink-secondary">
                            {entry.organization}
                          </p>
                        ) : null}
                        <p className="mb-3 text-sm leading-relaxed text-ink">
                          {entry.description}
                        </p>
                        {entry.bullets.length > 0 ? (
                          <ul className="mb-3 space-y-1.5">
                            {entry.bullets.map((bullet) => (
                              <li
                                key={bullet}
                                className="flex items-start gap-2 text-sm leading-relaxed text-ink-secondary"
                              >
                                <span className="mt-0.5 text-ink-muted" aria-hidden>
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
                                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
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
        </section>

        <aside
          className="mt-14 border-t border-line pt-6"
          aria-labelledby="versionierung-heading"
        >
          <h3
            id="versionierung-heading"
            className="mb-2 text-sm font-semibold text-ink"
          >
            {PUBLIC_METHODOLOGY_VERSIONING.title}
          </h3>
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
      </article>
    </div>
  );
}
