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
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] sm:p-8">
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
