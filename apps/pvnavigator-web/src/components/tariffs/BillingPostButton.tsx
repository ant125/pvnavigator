"use client";

import { useState } from "react";

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-60";

const ghostBtn =
  "inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#FAFBFC] disabled:cursor-not-allowed disabled:opacity-60";

export function BillingPostButton({
  action,
  label,
  pendingLabel,
  formId,
  tone = "primary",
  fields,
}: {
  action: string;
  label: string;
  pendingLabel: string;
  formId?: string;
  tone?: "primary" | "ghost";
  fields?: Record<string, string>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <form id={formId} action={action} method="post" onSubmit={() => setPending(true)}>
      {fields
        ? Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      <button type="submit" disabled={pending} className={tone === "primary" ? primaryBtn : ghostBtn}>
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}
