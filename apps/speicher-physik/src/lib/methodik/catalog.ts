/**
 * Public Methodik documentation catalog.
 * Adding an article later should only require a catalog entry and a page body.
 */

export type MethodikStatus = "aktuell" | "entwurf" | "ersetzt";

export type MethodikGroupId =
  | "load"
  | "weather"
  | "simulation"
  | "site"
  | "economics";

export type MethodikGroup = {
  id: MethodikGroupId;
  title: string;
  order: number;
};

export type MethodikArticleMeta = {
  slug: string;
  title: string;
  navTitle: string;
  summary: string;
  version: string;
  publishedAt: string;
  updatedAt: string;
  status: MethodikStatus;
  groupId: MethodikGroupId;
};

export const METHODIK_GROUPS: readonly MethodikGroup[] = [
  { id: "load", title: "Lastprofile", order: 1 },
  { id: "weather", title: "Wetter und PV-Erzeugung", order: 2 },
  { id: "simulation", title: "Speichersimulation", order: 3 },
  { id: "site", title: "Standort und Dach", order: 4 },
  { id: "economics", title: "Wirtschaftlichkeit", order: 5 },
] as const;

export const METHODIK_ARTICLES: readonly MethodikArticleMeta[] = [
  {
    slug: "elektroauto-ladeprofil",
    title: "Elektroauto-Ladeprofil (EV v1)",
    navTitle: "Elektroauto-Ladeprofil",
    summary:
      "Individuelles 15-Minuten-Heimladeprofil aus Fahrleistung, Fahrverhalten, Ladefenstern, Arbeitsplatzladung und Fahrzeugbatterie.",
    version: "1.0",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    status: "aktuell",
    groupId: "load",
  },
] as const;

export const METHODIK_STATUS_LABEL: Record<MethodikStatus, string> = {
  aktuell: "Aktuell",
  entwurf: "Entwurf",
  ersetzt: "Ersetzt",
};

export function getMethodikArticle(slug: string): MethodikArticleMeta | undefined {
  return METHODIK_ARTICLES.find((article) => article.slug === slug);
}

export function getMethodikArticlesByGroup(): {
  group: MethodikGroup;
  articles: MethodikArticleMeta[];
}[] {
  return METHODIK_GROUPS.map((group) => ({
    group,
    articles: METHODIK_ARTICLES.filter((article) => article.groupId === group.id),
  })).filter((entry) => entry.articles.length > 0);
}

export function formatMethodikMonthYear(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(date);
}
