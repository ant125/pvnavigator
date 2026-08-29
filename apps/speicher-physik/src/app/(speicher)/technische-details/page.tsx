import fs from "fs";
import path from "path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

export const metadata = {
  title: "Technische Details zur Berechnung | PV Speicher Rechner",
  description:
    "Technische Berechnungsgrundlagen des PVNavigator Speicher-Rechners.",
};

export default function TechnischeDetailsPage() {
  const filePath = path.join(
    process.cwd(),
    "..",
    "..",
    "docs",
    "physics-model.md",
  );
  const content = fs.readFileSync(filePath, "utf-8");

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <aside className="mb-10 border-y border-line py-6">
        <h2 className="text-lg font-semibold text-ink mb-2">
          Methodik & Quellen
        </h2>
        <p className="text-sm leading-relaxed text-ink-secondary mb-4 max-w-reading">
          Hier dokumentieren wir die Datenquellen und methodischen Annahmen, auf
          denen die Berechnungen beruhen — öffentlich und nachvollziehbar.
        </p>
        <Link
          href="/methodik-quellen"
          className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
        >
          → Methodik & Quellen
        </Link>
      </aside>

      <div className="prose prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
