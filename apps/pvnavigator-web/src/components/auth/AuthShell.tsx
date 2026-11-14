import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-4 py-10 md:py-14">
      <div className="mx-auto w-full max-w-md">
        <div className="hub-panel p-6 sm:p-8">
          <p className="hub-kicker mb-4">PVNAVIGATOR_ / Zugang</p>
          <h1 className="text-xl font-semibold tracking-tight text-[#0F172A] sm:text-[1.35rem]">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{subtitle}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
