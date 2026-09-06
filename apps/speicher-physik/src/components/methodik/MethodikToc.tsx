"use client";

import { useEffect, useState } from "react";

import type { MethodikTocItem } from "@/lib/methodik/headings";

type TocGroup = {
  heading: MethodikTocItem;
  children: MethodikTocItem[];
};

function groupHeadings(headings: readonly MethodikTocItem[]): TocGroup[] {
  const groups: TocGroup[] = [];
  for (const heading of headings) {
    if (heading.level === 2 || groups.length === 0) {
      groups.push({ heading, children: [] });
      continue;
    }
    groups[groups.length - 1].children.push(heading);
  }
  return groups;
}

function TocLink({
  heading,
  active,
  quiet = false,
}: {
  heading: MethodikTocItem;
  active: boolean;
  quiet?: boolean;
}) {
  const className = quiet
    ? active
      ? "methodik-toc-link methodik-toc-link-sub text-[13px] leading-snug font-medium text-ink-secondary"
      : "methodik-toc-link methodik-toc-link-sub text-[13px] leading-snug text-ink-muted transition-colors hover:text-ink-secondary"
    : active
      ? "methodik-toc-link text-sm font-medium text-ink"
      : "methodik-toc-link text-sm text-ink-secondary transition-colors hover:text-ink";

  return (
    <a href={`#${heading.id}`} className={className}>
      {heading.title}
    </a>
  );
}

export function MethodikToc({
  headings,
  variant,
}: {
  headings: readonly MethodikTocItem[];
  variant: "inline" | "aside";
}) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "");
  const groups = groupHeadings(headings);

  useEffect(() => {
    if (headings.length === 0) return undefined;

    const observers: IntersectionObserver[] = [];
    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (!element) continue;
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.find((entry) => entry.isIntersecting);
          if (visible?.target.id) {
            setActiveId(visible.target.id);
          }
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
      );
      observer.observe(element);
      observers.push(observer);
    }

    return () => {
      for (const observer of observers) observer.disconnect();
    };
  }, [headings]);

  if (headings.length === 0) return null;

  const list = (
    <ol
      className={
        variant === "aside"
          ? "methodik-toc-list space-y-2"
          : "methodik-toc-list grid gap-2 sm:grid-cols-2"
      }
    >
      {groups.map((group) => {
        const active = group.heading.id === activeId;
        return (
          <li key={group.heading.id}>
            <TocLink heading={group.heading} active={active} />
            {group.children.length > 0 ? (
              <ol className="methodik-toc-sub">
                {group.children.map((child) => (
                  <li key={child.id}>
                    <TocLink
                      heading={child}
                      active={child.id === activeId}
                      quiet
                    />
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ol>
  );

  if (variant === "aside") {
    return (
      <nav aria-label="Auf dieser Seite" className="methodik-toc-aside hidden xl:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Auf dieser Seite
        </p>
        {list}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Inhalt"
      className="mt-8 border-t border-line pt-6 xl:hidden"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Inhalt
      </p>
      {list}
    </nav>
  );
}
