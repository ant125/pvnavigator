import type { ReactNode } from "react";

export function MethodikDownloadBox({
  title,
  description,
  href,
  fileLabel,
  children,
}: {
  title: string;
  description: string;
  href: string;
  fileLabel: string;
  children?: ReactNode;
}) {
  return (
    <aside className="my-6 border border-line bg-surface px-4 py-4 sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        CSV-Datei
      </p>
      <p className="mt-1.5 text-base font-semibold text-ink">{title}</p>
      <p className="mt-2 max-w-reading text-sm leading-relaxed text-ink-secondary">
        {description}
      </p>
      <p className="mt-3">
        <a
          href={href}
          download
          className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
        >
          {fileLabel} herunterladen
        </a>
      </p>
      {children ? <div className="mt-4">{children}</div> : null}
    </aside>
  );
}
