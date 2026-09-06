import type { ReactNode } from "react";

import type { MethodikArticleMeta } from "@/lib/methodik/catalog";
import { collectMethodikHeadings } from "@/lib/methodik/headings";

import { MethodikPageFrame } from "./MethodikPageFrame";
import { MethodikToc } from "./MethodikToc";
import { MethodikVersionBox } from "./MethodikVersionBox";

export function MethodikArticle({
  article,
  children,
}: {
  article: MethodikArticleMeta;
  children: ReactNode;
}) {
  const headings = collectMethodikHeadings(children);

  return (
    <MethodikPageFrame
      currentSlug={article.slug}
      toc={<MethodikToc headings={headings} variant="aside" />}
    >
      <article className="methodik-print-wide">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">
            Methodik
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {article.title}
          </h1>
        </header>

        <div className="mt-6">
          <MethodikVersionBox article={article} />
        </div>

        <MethodikToc headings={headings} variant="inline" />

        <div className="methodik-article-body">{children}</div>
      </article>
    </MethodikPageFrame>
  );
}
