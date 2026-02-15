/**
 * Building Types for PVNavigator
 * 
 * Used to classify the building type and gate the automatic roof calculation.
 * MVP v1 only supports detached single-family houses (Einfamilienhaus).
 */

/**
 * Building type classification
 * 
 * CRITICAL RULE (MVP v1):
 * Only "EINFAMILIENHAUS" is supported for automatic roof calculation.
 * All other types (shared roofs) must be blocked from entering the pipeline.
 */
export type BuildingType = 
  | "EINFAMILIENHAUS"   // Detached single-family house - SUPPORTED
  | "DOPPELHAUS"        // Semi-detached house (shared roof) - NOT SUPPORTED
  | "REIHENHAUS"        // Terraced house - NOT SUPPORTED  
  | "MEHRPARTEIEN";     // Shared roof with multiple units - NOT SUPPORTED

/**
 * Building type metadata for UI rendering
 */
export interface BuildingTypeOption {
  type: BuildingType;
  label: string;
  description: string;
  emoji: string;
  supported: boolean;
}

/**
 * All available building type options with metadata
 */
export const BUILDING_TYPE_OPTIONS: BuildingTypeOption[] = [
  {
    type: "EINFAMILIENHAUS",
    label: "Einfamilienhaus",
    description: "Freistehendes Einfamilienhaus",
    emoji: "🏠",
    supported: true,
  },
  {
    type: "DOPPELHAUS",
    label: "Doppelhaus",
    description: "Doppelhaushälfte (geteiltes Dach)",
    emoji: "🏘",
    supported: false,
  },
  {
    type: "REIHENHAUS",
    label: "Reihenhaus",
    description: "Reihenhaus",
    emoji: "🏘",
    supported: false,
  },
  {
    type: "MEHRPARTEIEN",
    label: "Mehrparteien-Dach",
    description: "Gemeinsames Dach mit mehreren Einheiten",
    emoji: "🏢",
    supported: false,
  },
];

/**
 * Check if a building type is supported for automatic roof calculation
 * 
 * CRITICAL: This is the gating function for the MVP.
 * No roof geometry extraction may run unless this returns true.
 */
export function isBuildingTypeSupported(type: BuildingType | null): boolean {
  return type === "EINFAMILIENHAUS";
}

/**
 * Get building type option by type
 */
export function getBuildingTypeOption(type: BuildingType): BuildingTypeOption | undefined {
  return BUILDING_TYPE_OPTIONS.find(option => option.type === type);
}




