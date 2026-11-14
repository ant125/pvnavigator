"use client";

import Link from "next/link";

export default function AdminError() {
  return (
    <section className="hub-panel hub-account" role="alert">
      <h2 className="hub-kicker">Administration</h2>
      <p>Die Angaben konnten nicht geladen werden.</p>
      <Link href="/admin" className="hub-text-link">Zur Übersicht</Link>
    </section>
  );
}
