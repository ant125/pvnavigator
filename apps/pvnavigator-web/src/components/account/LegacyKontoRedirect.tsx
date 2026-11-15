"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Older profile links pointed at /konto#profil. The form now lives on its own page. */
export function LegacyKontoRedirect() {
  const router = useRouter();
  useEffect(() => {
    const profil = new URLSearchParams(window.location.search).get("profil");
    if (window.location.hash === "#profil" || profil === "gespeichert" || profil === "ungueltig") {
      const next = profil === "gespeichert" || profil === "ungueltig" ? `/konto/profil?profil=${profil}` : "/konto/profil";
      router.replace(next);
    }
  }, [router]);
  return null;
}
