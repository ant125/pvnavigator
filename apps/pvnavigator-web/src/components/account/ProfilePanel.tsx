"use client";

import { useState } from "react";

import { profileIsSaved, type AccountProfileView } from "@/lib/accountProfile";
import { ProfileForm } from "./ProfileForm";

export function ProfilePanel({
  email,
  profile,
  status,
}: {
  email: string;
  profile: AccountProfileView;
  status?: "saved" | "invalid" | null;
}) {
  const saved = profileIsSaved(profile);
  const [editing, setEditing] = useState(!saved || status === "invalid");

  if (saved && !editing) {
    return (
      <section id="profil" className="hub-panel hub-account account-profile" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Persönliche Daten</h2>
        {status === "saved" ? <p role="status" className="hub-notice">Profil gespeichert.</p> : null}
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{profile.givenName} {profile.familyName}</dd>
          </div>
          {profile.accountKind === "unternehmen" ? (
            <div>
              <dt>Unternehmen</dt>
              <dd>{profile.companyName}</dd>
            </div>
          ) : null}
          <div>
            <dt>Kontoart</dt>
            <dd>{profile.accountKind === "unternehmen" ? "Unternehmen" : "Privatperson"}</dd>
          </div>
          <div>
            <dt>E-Mail</dt>
            <dd>{email}</dd>
          </div>
        </dl>
        <button type="button" className="hub-secondary" onClick={() => setEditing(true)}>Profil bearbeiten</button>
      </section>
    );
  }

  return (
    <section id="profil" className="hub-panel hub-account account-profile" aria-labelledby="profile-heading">
      <div className="account-profile-toolbar">
        <h2 id="profile-heading">Persönliche Daten</h2>
        {saved ? <button type="button" className="hub-secondary" onClick={() => setEditing(false)}>Abbrechen</button> : null}
      </div>
      <p className="hub-email">{email}</p>
      <p>Angemeldetes PVNAVIGATOR_ Konto</p>
      <div className="mt-4">
        <ProfileForm profile={profile} status={status === "saved" ? null : status} />
      </div>
    </section>
  );
}
