import type { ReactNode } from "react";

import type { MethodikArticleMeta } from "@/lib/methodik/catalog";
import { METHODIK_ARTICLES } from "@/lib/methodik/catalog";

import { MethodikMobileNav, MethodikSideNav } from "./MethodikNav";

export function MethodikPageFrame({
  currentSlug,
  toc,
  children,
}: {
  currentSlug?: string;
  toc?: ReactNode;
  children: ReactNode;
}) {
  const currentArticle = METHODIK_ARTICLES.find(
    (article) => article.slug === currentSlug
  );

  return (
    <div className="methodik-docs max-w-docs mx-auto px-4 sm:px-6 lg:px-8">
      <MethodikMobileNav currentArticle={currentArticle} />
      <div
        className={
          toc
            ? "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[15rem_minmax(0,46rem)_13rem] xl:gap-12"
            : "lg:grid lg:grid-cols-[14rem_minmax(0,46rem)] lg:gap-10"
        }
      >
        <div className="hidden lg:block print:hidden">
          <div className="sticky top-24 py-8">
            <MethodikSideNav currentSlug={currentSlug} />
          </div>
        </div>
        <div className="min-w-0 py-8 lg:py-10">{children}</div>
        {toc ? (
          <div className="hidden xl:block print:hidden">
            <div className="sticky top-24 py-8">{toc}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
