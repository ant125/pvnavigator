import type { ReactNode } from "react";

import { slugifyHeading } from "@/lib/methodik/headings";

type SectionProps = {
  id?: string;
  title: string;
  children?: ReactNode;
};

export function MethodikSection({ id, title, children }: SectionProps) {
  const headingId = id ?? slugifyHeading(title);

  return (
    <section
      aria-labelledby={headingId}
      className="mt-14 border-t border-line pt-10 print:break-inside-avoid-page"
    >
      <h2
        id={headingId}
        className="scroll-mt-28 text-[1.85rem] font-semibold tracking-tight text-ink sm:text-[2rem]"
      >
        {title}
      </h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

MethodikSection.methodikLevel = 2 as const;

export function MethodikSubSection({ id, title, children }: SectionProps) {
  const headingId = id ?? slugifyHeading(title);

  return (
    <section
      aria-labelledby={headingId}
      className="methodik-subsection !mt-3 border-l border-line pl-4 pt-1 sm:pl-5"
    >
      <h3
        id={headingId}
        className="scroll-mt-28 text-base font-semibold tracking-tight text-ink sm:text-lg"
      >
        {title}
      </h3>
      <div className="mt-2.5 space-y-4">{children}</div>
    </section>
  );
}

MethodikSubSection.methodikLevel = 3 as const;

export function MethodikMinorHeading({ id, title, children }: SectionProps) {
  const headingId = id ?? slugifyHeading(title);

  return (
    <section aria-labelledby={headingId} className="pt-2">
      <h3
        id={headingId}
        className="scroll-mt-28 text-lg font-semibold tracking-tight text-ink sm:text-xl"
      >
        {title}
      </h3>
      {children ? <div className="mt-3 space-y-4">{children}</div> : null}
    </section>
  );
}

export function MethodikKickerHeading({ title }: { title: string }) {
  return (
    <h4 className="text-base font-semibold tracking-tight text-ink">{title}</h4>
  );
}

export function MethodikP({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-reading text-base leading-[1.7] text-ink-secondary">
      {children}
    </p>
  );
}

export function MethodikList({ items }: { items: readonly string[] }) {
  return (
    <ul className="max-w-reading space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2.5 text-base leading-[1.7] text-ink-secondary"
        >
          <span
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
