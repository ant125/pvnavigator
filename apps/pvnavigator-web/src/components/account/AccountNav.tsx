"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/konto", label: "Übersicht", match: (path: string) => path === "/konto" },
  { href: "/konto/berechnungen", label: "Meine Berechnungen", match: (path: string) => path.startsWith("/konto/berechnungen") },
  { href: "/feedback", label: "Feedback & Support", match: (path: string) => path === "/feedback" || path.startsWith("/feedback/") },
  { href: "/konto/profil", label: "Persönliche Daten", match: (path: string) => path.startsWith("/konto/profil") },
];

export function AccountNav({ unread = null }: { unread?: number | null }) {
  const path = usePathname();
  return (
    <nav className="account-nav" aria-label="Mein Konto">
      {items.map((item) => {
        const current = item.match(path);
        const showUnread = item.href === "/feedback" && unread != null && unread > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            aria-label={showUnread ? `Feedback & Support, ${unread} ungelesene Antworten` : undefined}
          >
            {item.label}
            {showUnread ? <span className="account-nav-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
