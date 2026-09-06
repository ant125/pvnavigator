import Link from "next/link";

import {
  METHODIK_STATUS_LABEL,
  formatMethodikMonthYear,
  type MethodikArticleMeta,
} from "@/lib/methodik/catalog";

export function MethodikDocCard({ article }: { article: MethodikArticleMeta }) {
  return (
    <Link
      href={`/methodik/${article.slug}`}
      className="block border border-line bg-surface px-5 py-4 transition-colors hover:border-line-strong"
    >
      <h2 className="text-lg font-semibold tracking-tight text-ink">
        {article.title}
      </h2>
      <p className="mt-2 max-w-reading text-sm leading-relaxed text-ink-secondary">
        {article.summary}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-ink-muted">Status</dt>
          <dd className="mt-0.5 font-medium text-success">
            {METHODIK_STATUS_LABEL[article.status]}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Version</dt>
          <dd className="mt-0.5 font-medium text-ink">{article.version}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Stand</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {formatMethodikMonthYear(article.updatedAt)}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
