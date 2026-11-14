import Link from "next/link";

import { requireAdmin } from "@/lib/admin";

export default async function AdminPage() {
  const user = await requireAdmin();

  return (
    <div className="hub-workspace">
      <header className="hub-intro">
        <div>
          <p className="hub-kicker">PVNAVIGATOR_ / Administration</p>
          <h1>Administration</h1>
          <p className="hub-subtitle">Geschützter Bereich für die Verwaltung von PVNAVIGATOR_.</p>
        </div>
      </header>
      <section className="hub-panel hub-account" aria-labelledby="admin-access-heading">
        <h2 id="admin-access-heading" className="hub-kicker">Zugang</h2>
        <p className="hub-email">{user.email}</p>
        <p>Dieses Konto hat Administratorrechte. Nutzerübersicht und Statistik folgen im nächsten Schritt.</p>
        <Link href="/konto" className="hub-text-link">Zu Mein Konto →</Link>
      </section>
    </div>
  );
}
