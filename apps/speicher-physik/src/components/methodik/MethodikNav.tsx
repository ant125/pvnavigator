"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  getMethodikArticlesByGroup,
  type MethodikArticleMeta,
} from "@/lib/methodik/catalog";

function navLinkClass(active: boolean): string {
  return active
    ? "block rounded-md bg-accent-soft px-2.5 py-1.5 text-sm font-medium text-ink"
    : "block rounded-md px-2.5 py-1.5 text-sm text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink";
}

export function MethodikSideNav({
  currentSlug,
}: {
  currentSlug?: string;
}) {
  const pathname = usePathname();
  const groups = getMethodikArticlesByGroup();
  const overviewActive = pathname === "/methodik";
  const referenzActive = pathname === "/methodik/referenz";

  return (
    <nav aria-label="Dokumentation" className="methodik-nav">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Dokumentation
      </p>
      <ul className="space-y-1">
        <li>
          <Link href="/methodik" className={navLinkClass(overviewActive)}>
            Übersicht
          </Link>
        </li>
        <li>
          <Link href="/methodik/referenz" className={navLinkClass(referenzActive)}>
            Referenz
          </Link>
        </li>
      </ul>
      {groups.map(({ group, articles }) => (
        <div key={group.id} className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {group.title}
          </p>
          <ul className="space-y-1">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/methodik/${article.slug}`}
                  className={navLinkClass(currentSlug === article.slug)}
                >
                  {article.navTitle}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function MethodikMobileNav({
  currentArticle,
}: {
  currentArticle?: MethodikArticleMeta;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const currentLabel =
    currentArticle?.navTitle ??
    (pathname === "/methodik/referenz" ? "Referenz" : "Methodik");

  return (
    <div className="methodik-mobile-nav lg:hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between border-b border-line bg-surface px-4 py-3 text-left text-sm font-medium text-ink"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{currentLabel}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {open ? "Schließen" : "Menü"}
        </span>
      </button>
      {open ? (
        <div className="border-b border-line bg-surface px-4 py-4">
          <MethodikSideNav currentSlug={currentArticle?.slug} />
        </div>
      ) : null}
    </div>
  );
}
