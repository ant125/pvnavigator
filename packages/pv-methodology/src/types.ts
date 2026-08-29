/**
 * Central Methodik & Quellen registry types.
 *
 * Every engineering assumption used in production must eventually reference
 * a registered source here. See docs/ARCHITECTURE.md (Engineering Rule).
 */

export type MethodologyCategoryId =
  | "weather"
  | "load_profiles"
  | "battery_simulation"
  | "battery_manufacturers"
  | "research"
  | "standards"
  | "economics";

export type MethodologySourceType =
  | "api"
  | "dataset"
  | "documentation"
  | "manufacturer"
  | "research"
  | "standard"
  | "methodology"
  | "warranty";

export type MethodologySource = {
  /** Stable unique id (kebab-case). */
  id: string;
  category: MethodologyCategoryId;
  title: string;
  organization: string;
  description: string;
  /** Official public URL, or null for internal methodology notes. */
  url: string | null;
  /** True when the URL points to an official publisher / manufacturer page. */
  official: boolean;
  sourceType: MethodologySourceType;
  /** Human-readable version or edition label when known. */
  version: string | null;
  /** ISO date when the entry was first registered (YYYY-MM-DD). */
  addedAt: string;
  /** ISO date when the entry was last reviewed or updated (YYYY-MM-DD). */
  updatedAt: string;
};

export type MethodologyCategory = {
  id: MethodologyCategoryId;
  title: string;
  /** Short German section intro for website / PDF. */
  description: string;
};

/**
 * Flat, PDF-oriented projection of the registry.
 * Future PDF reports must consume this helper — never duplicate source lists.
 */
export type MethodologySourcePdfEntry = {
  id: string;
  categoryId: MethodologyCategoryId;
  categoryTitle: string;
  title: string;
  organization: string;
  description: string;
  url: string | null;
  official: boolean;
  sourceType: MethodologySourceType;
  version: string | null;
  addedAt: string;
  updatedAt: string;
};
