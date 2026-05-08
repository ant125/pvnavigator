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
  const markdown = fs.readFileSync(filePath, "utf-8");

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-slate-200">
      <article className="prose-invert leading-relaxed space-y-4">
        <ReactMarkdown
          components={{
            h1: (props) => (
              <h1
                className="text-3xl font-bold text-slate-50 mt-8 mb-4"
                {...props}
              />
            ),
            h2: (props) => (
              <h2
                className="text-2xl font-semibold text-slate-100 mt-8 mb-3"
                {...props}
              />
            ),
            h3: (props) => (
              <h3
                className="text-xl font-semibold text-slate-100 mt-6 mb-2"
                {...props}
              />
            ),
            p: (props) => (
              <p className="text-slate-300 my-3" {...props} />
            ),
            ul: (props) => (
              <ul
                className="list-disc list-inside text-slate-300 my-3 space-y-1"
                {...props}
              />
            ),
            ol: (props) => (
              <ol
                className="list-decimal list-inside text-slate-300 my-3 space-y-1"
                {...props}
              />
            ),
            li: (props) => <li className="text-slate-300" {...props} />,
            hr: () => <hr className="border-slate-800 my-6" />,
            strong: (props) => (
              <strong className="text-slate-100 font-semibold" {...props} />
            ),
            code: (props) => (
              <code
                className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-slate-200"
                {...props}
              />
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
