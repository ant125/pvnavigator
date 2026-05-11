import type { Metadata } from "next";
import "./globals.css";
import { SpeicherShell } from "./(speicher)/components/SpeicherShell";

export const metadata: Metadata = {
  title: "PV Speicher Rechner | PVNavigator",
  description: "Unabhängige Wirtschaftlichkeitsanalyse für Stromspeicher.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        <SpeicherShell>{children}</SpeicherShell>
      </body>
    </html>
  );
}
