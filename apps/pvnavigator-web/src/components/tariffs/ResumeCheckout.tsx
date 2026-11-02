"use client";

import { useEffect, useRef } from "react";

/** Continues a paid-plan choice that was kept across sign-in. Posts once. */
export function ResumeCheckout({ formId }: { formId: string }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const form = document.getElementById(formId);
    if (form instanceof HTMLFormElement) form.requestSubmit();
  }, [formId]);
  return (
    <p className="text-sm text-[#64748B]" role="status">
      Weiter zur Zahlung…
    </p>
  );
}
