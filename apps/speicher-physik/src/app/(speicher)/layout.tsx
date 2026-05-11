import type { Metadata } from "next";

/**
 * Speicher Module Layout
 *
 * This is the root layout for the Speicher-Rechner module.
 * Accessible via: speicher.pvnavigator.de
 *
 * ARCHITECTURE NOTES:
 * - This module is part of PVNavigator platform but has its own subdomain
 * - Shares authentication/billing with main app (future)
 * - No Bavaria restriction - Speicher module works globally
 * - Designed for future: subscription checks, paywall, PDF export
 */

export const metadata: Metadata = {
  title: "PV Speicher Rechner | PVNavigator",
  description:
    "Unabhängige Wirtschaftlichkeitsanalyse für Stromspeicher. Wir zeigen, ob sich ein Speicher für Ihr Haus lohnt – in Zahlen.",
  keywords: [
    "Stromspeicher",
    "Batteriespeicher",
    "PV Speicher",
    "Wirtschaftlichkeit",
    "Speicher Rechner",
    "Photovoltaik",
  ],
};

export default function SpeicherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

