import fs from "fs";
import path from "path";
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
    <div className="prose prose-invert max-w-3xl mx-auto px-4 py-10">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
