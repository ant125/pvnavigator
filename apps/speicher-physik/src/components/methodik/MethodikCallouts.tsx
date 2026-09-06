import type { ReactNode } from "react";

type CalloutTone = "info" | "warning" | "example" | "note";

const TONE: Record<
  CalloutTone,
  { bar: string; bg: string; label: string }
> = {
  info: {
    bar: "border-accent",
    bg: "bg-accent-soft/70",
    label: "text-accent-text",
  },
  warning: {
    bar: "border-warning",
    bg: "bg-warning-soft",
    label: "text-warning",
  },
  example: {
    bar: "border-line-strong",
    bg: "bg-surface-muted",
    label: "text-ink",
  },
  note: {
    bar: "border-line-strong",
    bg: "bg-surface",
    label: "text-ink-muted",
  },
};

function Callout({
  tone,
  kicker,
  title,
  children,
}: {
  tone: CalloutTone;
  kicker: string;
  title?: string;
  children: ReactNode;
}) {
  const style = TONE[tone];

  return (
    <aside
      className={`my-6 max-w-reading border-l-2 ${style.bar} ${style.bg} px-4 py-3 sm:px-5`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${style.label}`}
      >
        {kicker}
      </p>
      {title ? (
        <p className="mt-1.5 text-sm font-semibold text-ink">{title}</p>
      ) : null}
      <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-ink">
        {children}
      </div>
    </aside>
  );
}

export function MethodikInfoBox({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <Callout tone="info" kicker="Hinweis" title={title}>
      {children}
    </Callout>
  );
}

export function MethodikWarningBox({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <Callout tone="warning" kicker="Achtung" title={title}>
      {children}
    </Callout>
  );
}

export function MethodikExampleBox({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <Callout tone="example" kicker="Rechenbeispiel" title={title}>
      {children}
    </Callout>
  );
}

export function MethodikEngineeringNote({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <Callout tone="note" kicker="Engineering Note" title={title}>
      {children}
    </Callout>
  );
}
