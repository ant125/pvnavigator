import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Methodik | SPEICHERGRENZE",
  description:
    "Offizielle Dokumentation der Berechnungsverfahren von SPEICHERGRENZE.",
};

export default function MethodikLayout({ children }: { children: ReactNode }) {
  return children;
}
