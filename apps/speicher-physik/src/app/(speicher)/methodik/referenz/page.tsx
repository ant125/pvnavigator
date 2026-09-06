import type { Metadata } from "next";

import { MethodikPageFrame } from "@/components/methodik/MethodikPageFrame";
import {
  MethodikP,
  MethodikSection,
} from "@/components/methodik/MethodikSection";
import { MethodikToc } from "@/components/methodik/MethodikToc";
import { collectMethodikHeadings } from "@/lib/methodik/headings";

export const metadata: Metadata = {
  title: "Referenz | SpeicherGrenze",
  description:
    "Diese Referenz erklärt die verwendeten Fachbegriffe, Kennzahlen, Formeln und technischen Begriffe von SpeicherGrenze.",
};

export default function ReferenzPage() {
  const sections = (
    <>
      <MethodikSection title="Kennzahlen">
        <MethodikP>Kurze Beschreibung.</MethodikP>
        <MethodikP>(Inhalt folgt.)</MethodikP>
      </MethodikSection>
      <MethodikSection title="Formeln">
        <MethodikP>Kurze Beschreibung.</MethodikP>
        <MethodikP>(Inhalt folgt.)</MethodikP>
      </MethodikSection>
      <MethodikSection title="Fachbegriffe">
        <MethodikP>Kurze Beschreibung.</MethodikP>
        <MethodikP>(Inhalt folgt.)</MethodikP>
      </MethodikSection>
      <MethodikSection title="Einheiten">
        <MethodikP>Kurze Beschreibung.</MethodikP>
        <MethodikP>(Inhalt folgt.)</MethodikP>
      </MethodikSection>
    </>
  );
  const headings = collectMethodikHeadings(sections);

  return (
    <MethodikPageFrame toc={<MethodikToc headings={headings} variant="aside" />}>
      <article className="methodik-print-wide">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Referenz
          </h1>
          <div className="mt-5 space-y-4">
            <MethodikP>
              Diese Referenz erklärt die verwendeten Fachbegriffe, Kennzahlen,
              Formeln und technischen Begriffe von SpeicherGrenze.
            </MethodikP>
          </div>
        </header>
        <MethodikToc headings={headings} variant="inline" />
        <div className="methodik-article-body">{sections}</div>
      </article>
    </MethodikPageFrame>
  );
}
