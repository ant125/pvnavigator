import {
  METHODOLOGY_CATEGORIES,
  METHODOLOGY_CATEGORY_ORDER,
  getMethodologyCategory,
} from "./categories";
import { METHODOLOGY_SOURCES } from "./registry";
import type {
  MethodologyCategoryId,
  MethodologySourcePdfEntry,
} from "./types";

/**
 * Returns the full methodology registry in a flat, PDF-ready shape.
 *
 * Future PDF reports MUST call this function (or a thin wrapper around it).
 * Do not duplicate official source URLs or titles in report templates.
 */
export function getMethodologySources(): MethodologySourcePdfEntry[] {
  const categoryTitle = new Map(
    METHODOLOGY_CATEGORIES.map((c) => [c.id, c.title] as const),
  );

  const orderIndex = new Map(
    METHODOLOGY_CATEGORY_ORDER.map((id, i) => [id, i] as const),
  );

  return [...METHODOLOGY_SOURCES]
    .sort((a, b) => {
      const ca = orderIndex.get(a.category) ?? 999;
      const cb = orderIndex.get(b.category) ?? 999;
      if (ca !== cb) return ca - cb;
      return a.title.localeCompare(b.title, "de");
    })
    .map((s) => ({
      id: s.id,
      categoryId: s.category,
      categoryTitle:
        categoryTitle.get(s.category) ?? getMethodologyCategory(s.category).title,
      title: s.title,
      organization: s.organization,
      description: s.description,
      url: s.url,
      official: s.official,
      sourceType: s.sourceType,
      version: s.version,
      addedAt: s.addedAt,
      updatedAt: s.updatedAt,
    }));
}

/**
 * Grouped view for website / PDF section rendering.
 * Empty categories (standards, economics) are included so sections stay visible.
 */
export function getMethodologySourcesGrouped(): {
  categoryId: MethodologyCategoryId;
  categoryTitle: string;
  categoryDescription: string;
  sources: MethodologySourcePdfEntry[];
}[] {
  const flat = getMethodologySources();
  return METHODOLOGY_CATEGORY_ORDER.map((categoryId) => {
    const cat = getMethodologyCategory(categoryId);
    return {
      categoryId,
      categoryTitle: cat.title,
      categoryDescription: cat.description,
      sources: flat.filter((s) => s.categoryId === categoryId),
    };
  });
}
