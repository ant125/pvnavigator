"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Übersicht", match: (path: string) => path === "/admin" },
  { href: "/admin/nutzer", label: "Nutzer", match: (path: string) => path.startsWith("/admin/nutzer") },
  { href: "/admin/feedback", label: "Feedback", match: (path: string) => path.startsWith("/admin/feedback") },
];

export function AdminNav({ unreadFeedback = 0 }: { unreadFeedback?: number }) {
  const path = usePathname();
  return (
    <nav className="admin-tabs" aria-label="Administration">
      {items.map((item) => {
        const current = item.match(path);
        return (
          <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
            {item.label}
            {item.href === "/admin/feedback" && unreadFeedback > 0 ? (
              <span className="admin-tab-count" aria-label={`${unreadFeedback} ungelesene Nachrichten`}>
                {unreadFeedback}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
