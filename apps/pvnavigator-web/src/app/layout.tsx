import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PVNavigator – Unabhängige PV-Tools",
  description: "Unabhängige Tools rund um Photovoltaik – Physik, Wirtschaft, Planung.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        <div className="min-h-screen bg-slate-950 text-slate-50">
          {/* ========== HEADER ========== */}
          <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <span className="font-semibold text-slate-100">PVNavigator</span>
                </Link>

                <nav className="hidden sm:flex items-center gap-6">
                  <Link
                    href="/"
                    className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
                  >
                    Home
                  </Link>
                </nav>
              </div>
            </div>
          </header>

          {/* ========== MAIN CONTENT ========== */}
          <main>{children}</main>

          {/* ========== FOOTER ========== */}
          <footer className="border-t border-slate-800 py-8 mt-auto">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-slate-500">
                  © {new Date().getFullYear()} PVNavigator. Alle Rechte vorbehalten.
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <Link href="/impressum" className="hover:text-slate-300 transition-colors">
                    Impressum
                  </Link>
                  <span className="text-slate-700">•</span>
                  <Link href="/datenschutz" className="hover:text-slate-300 transition-colors">
                    Datenschutz
                  </Link>
                  <span className="text-slate-700">•</span>
                  <span>Unabhängige PV-Analyse</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
