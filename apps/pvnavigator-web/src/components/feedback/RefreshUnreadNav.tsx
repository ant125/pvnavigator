"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Reloads the shell so an unread counter matches a thread just opened. */
export function RefreshUnreadNav({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (active) router.refresh();
  }, [active, router]);
  return null;
}
