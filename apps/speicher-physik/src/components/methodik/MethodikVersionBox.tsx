import type { ReactNode } from "react";

import {
  METHODIK_STATUS_LABEL,
  formatMethodikMonthYear,
  type MethodikArticleMeta,
} from "@/lib/methodik/catalog";

const STATUS_CLASS: Record<MethodikArticleMeta["status"], string> = {
  aktuell: "text-success",
  entwurf: "text-warning",
  ersetzt: "text-ink-muted",
};

export function MethodikVersionBox({
  article,
}: {
  article: MethodikArticleMeta;
}) {
  return (
    <aside className="border border-line bg-surface-muted/70 px-4 py-4 sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Methodik-Version
      </p>
      <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-3">
        <MetaItem label="Version">{article.version}</MetaItem>
        <MetaItem label="Veröffentlicht">
          {formatMethodikMonthYear(article.publishedAt)}
        </MetaItem>
        <MetaItem label="Status">
          <span className={STATUS_CLASS[article.status]}>
            {METHODIK_STATUS_LABEL[article.status]}
          </span>
        </MetaItem>
      </dl>
    </aside>
  );
}

function MetaItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}
