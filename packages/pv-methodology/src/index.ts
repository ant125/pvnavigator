/**
 * @pv-methodology/registry
 *
 * Central Methodik & Quellen registry for all PVNavigator products.
 * Website, Technische Details, future PDF reports and sibling apps must
 * consume sources from here — never hardcode official source URLs elsewhere.
 */

export type {
  MethodologyCategory,
  MethodologyCategoryId,
  MethodologySource,
  MethodologySourcePdfEntry,
  MethodologySourceType,
} from "./types";

export {
  METHODOLOGY_CATEGORIES,
  METHODOLOGY_CATEGORY_ORDER,
  getMethodologyCategory,
} from "./categories";

export { METHODOLOGY_PRINCIPLES } from "./principles";

export {
  METHODOLOGY_SOURCES,
  getMethodologySourceById,
  getMethodologySourcesByCategory,
} from "./registry";

export {
  getMethodologySources,
  getMethodologySourcesGrouped,
} from "./getMethodologySources";

export {
  PUBLIC_METHODOLOGY_INTRO,
  PUBLIC_METHODOLOGY_VERSIONING,
  getPublicMethodologySections,
  getPublicHiddenSourceIds,
  type PublicMethodologyEntry,
  type PublicMethodologyLink,
  type PublicMethodologySection,
  type PublicMethodologySectionIcon,
} from "./publicPresentation";
