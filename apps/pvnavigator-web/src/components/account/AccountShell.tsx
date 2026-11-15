import type { ReactNode } from "react";

import { AuthEnvMissing } from "@/components/auth/AuthEnvMissing";
import { AccountNav } from "./AccountNav";

export function AccountUnavailable() {
  return (
    <div className="px-4 py-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-[1.75rem]">Mein Konto</h1>
        <div className="hub-panel mt-8 max-w-lg p-6 sm:p-8">
          <AuthEnvMissing />
        </div>
      </div>
    </div>
  );
}

export function AccountShell({
  title,
  subtitle,
  unread = null,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  unread?: number | null;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="hub-workspace">
      <header className="hub-intro">
        <div>
          <p className="hub-kicker">PVNAVIGATOR_ / Mein Konto</p>
          <h1>{title}</h1>
          {subtitle ? <p className="hub-subtitle">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      <AccountNav unread={unread} />
      {children}
    </div>
  );
}
