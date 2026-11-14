import Link from "next/link";

import { InfoBackButton } from "./InfoBackButton";

export function InfoPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="hub-intro">
      <div>
        <InfoBackButton />
        <nav className="hub-crumb" aria-label="Brotkrumenpfad">
          <Link href="/" className="hub-quiet-link">
            Startseite
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{title}</span>
        </nav>
        <h1>{title}</h1>
        {subtitle ? <p className="hub-subtitle">{subtitle}</p> : null}
      </div>
    </header>
  );
}
