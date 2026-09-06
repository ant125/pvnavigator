import type { Metadata } from "next";

import { MethodikDocCard } from "@/components/methodik/MethodikDocCard";
import { MethodikList, MethodikP } from "@/components/methodik/MethodikSection";
import { MethodikPageFrame } from "@/components/methodik/MethodikPageFrame";
import { METHODIK_ARTICLES } from "@/lib/methodik/catalog";

export const metadata: Metadata = {
  title: "Methodik | SpeicherGrenze",
  description:
    "Diese Dokumentation beschreibt die Berechnungsverfahren von SpeicherGrenze.",
};

export default function MethodikIndexPage() {
  return (
    <MethodikPageFrame>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Methodik
        </h1>
        <div className="mt-5 space-y-4">
          <MethodikP>
            Diese Dokumentation beschreibt die Berechnungsverfahren von
            SpeicherGrenze.
          </MethodikP>
          <MethodikP>
            Ziel ist es, alle Ergebnisse nachvollziehbar, reproduzierbar und
            transparent zu machen.
          </MethodikP>
        </div>
        <div className="mt-8">
          <p className="text-sm font-semibold text-ink">
            Jede Methodik beschreibt
          </p>
          <div className="mt-3">
            <MethodikList
              items={[
                "verwendete Eingabedaten",
                "Berechnungsablauf",
                "Rechenbeispiele",
                "Modellgrenzen",
                "Versionierung",
              ]}
            />
          </div>
        </div>
      </header>

      <section className="mt-12 border-t border-line pt-8" aria-labelledby="methodik-artikel">
        <h2
          id="methodik-artikel"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          Dokumentierte Verfahren
        </h2>
        <ul className="mt-5 max-w-reading space-y-4">
          {METHODIK_ARTICLES.map((article) => (
            <li key={article.slug}>
              <MethodikDocCard article={article} />
            </li>
          ))}
        </ul>
      </section>
    </MethodikPageFrame>
  );
}
