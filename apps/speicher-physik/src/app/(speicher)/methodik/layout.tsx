import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Methodik | SpeicherGrenze",
  description:
    "Offizielle Dokumentation der Berechnungsverfahren von SpeicherGrenze.",
};

export default function MethodikLayout({ children }: { children: ReactNode }) {
  return children;
}
