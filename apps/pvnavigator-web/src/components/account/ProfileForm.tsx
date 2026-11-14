"use client";

import { useState } from "react";

import type { AccountKindChoice, AccountProfileView } from "@/lib/accountProfile";

const field = "block text-sm font-medium text-[#0F172A]";

export function ProfileForm({
  profile,
  status,
}: {
  profile: AccountProfileView;
  status?: "saved" | "invalid" | null;
}) {
  const [kind, setKind] = useState<AccountKindChoice>(profile.accountKind ?? "privat");
  const incomplete = profile.accountKind === null;

  return (
    <form id="profil" action="/konto/profil" method="post" className="space-y-4">
      {incomplete ? (
        <p role="status" className="hub-notice">
          Bitte ergänzen Sie Ihr Profil. Ihre Berechnungen bleiben verfügbar.
        </p>
      ) : null}
      {status === "saved" ? <p role="status" className="hub-notice">Profil gespeichert.</p> : null}
      {status === "invalid" ? (
        <p role="alert" className="hub-notice">Bitte füllen Sie alle Pflichtfelder aus.</p>
      ) : null}
      <fieldset className="space-y-2">
        <legend className={field}>Art des Kontos</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="account_kind"
            value="privat"
            checked={kind === "privat"}
            onChange={() => setKind("privat")}
            required
          />
          Privatperson
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="account_kind"
            value="unternehmen"
            checked={kind === "unternehmen"}
            onChange={() => setKind("unternehmen")}
          />
          Unternehmen
        </label>
      </fieldset>
      {kind === "unternehmen" ? (
        <div>
          <label htmlFor="profile-company" className={field}>Firmenname</label>
          <input id="profile-company" name="company_name" required maxLength={160} defaultValue={profile.companyName} autoComplete="organization" className="hub-input" />
        </div>
      ) : null}
      <div>
        <label htmlFor="profile-given" className={field}>
          {kind === "unternehmen" ? "Ansprechpartner (Vorname)" : "Vorname"}
        </label>
        <input id="profile-given" name="given_name" required maxLength={80} defaultValue={profile.givenName} autoComplete="given-name" className="hub-input" />
      </div>
      <div>
        <label htmlFor="profile-family" className={field}>
          {kind === "unternehmen" ? "Ansprechpartner (Nachname)" : "Nachname"}
        </label>
        <input id="profile-family" name="family_name" required maxLength={80} defaultValue={profile.familyName} autoComplete="family-name" className="hub-input" />
      </div>
      <button type="submit" className="hub-primary">Profil speichern</button>
    </form>
  );
}
