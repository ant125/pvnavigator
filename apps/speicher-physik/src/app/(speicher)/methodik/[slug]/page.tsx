import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ElektroautoLadeprofilArticle } from "../_articles/elektroauto-ladeprofil";
import {
  METHODIK_ARTICLES,
  getMethodikArticle,
} from "@/lib/methodik/catalog";
import { loadEvHomeChargingExample } from "@/lib/methodik/exampleCsv";

export function generateStaticParams() {
  return METHODIK_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getMethodikArticle(slug);
  if (!article) {
    return { title: "Methodik | SpeicherGrenze" };
  }
  return {
    title: `${article.title} | Methodik | SpeicherGrenze`,
    description: article.summary,
  };
}

export default async function MethodikArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getMethodikArticle(slug);
  if (!article) notFound();

  if (article.slug === "elektroauto-ladeprofil") {
    const example = loadEvHomeChargingExample();
    return (
      <ElektroautoLadeprofilArticle article={article} example={example} />
    );
  }

  notFound();
}
