/**
 * Bavaria Region Validation for PVNavigator
 * 
 * PVNavigator MVP supports only locations within Bavaria (Germany).
 * This module provides geographic validation to ensure coordinates
 * are inside the supported region before any analysis begins.
 * 
 * IMPORTANT: This is a bounding box check (MVP-acceptable).
 * May be replaced by a Bavaria polygon (GeoJSON) in future versions.
 */

import { Coordinates } from "../types/location";

/**
 * Official Bavaria Bounding Box (MVP)
 * 
 * Verified coordinates for Bavaria (Freistaat Bayern):
 * - minLat: 47.2701 — Southern Bavaria (near Oberstdorf)
 * - maxLat: 50.5647 — Northern Bavaria (near Hof)
 * - minLng: 9.9930  — Western Bavaria border (Bavaria side, NOT Baden-Württemberg)
 * - maxLng: 13.8396 — Eastern Bavaria border (near Berchtesgaden)
 * 
 * Test cases (must pass):
 * ✅ München (48.137, 11.575) → true
 * ✅ Nürnberg (49.453, 11.077) → true
 * ✅ Regensburg (49.013, 12.101) → true
 * ❌ Engstingen (48.39, 9.30) → false (Baden-Württemberg)
 * ❌ Stuttgart (48.775, 9.182) → false (Baden-Württemberg)
 * ❌ Berlin (52.52, 13.405) → false (too far north)
 */
export const BAVARIA_BOUNDS = {
  minLat: 47.2701,
  maxLat: 50.5647,
  minLng: 9.9930,
  maxLng: 13.8396,
} as const;

/**
 * Check if coordinates are inside Bavaria (bounding box check)
 * 
 * CRITICAL: This is the single source of truth for the Bavaria Gate.
 * No DOM, roof, or PV calculations may run for coordinates outside Bavaria.
 * 
 * Uses ONLY latitude and longitude — no postal codes, address strings, or geocoding metadata.
 * 
 * @param coords - The coordinates to validate (lat, lng)
 * @returns true if coordinates are inside Bavaria, false otherwise
 */
export function isInsideBavaria(coords: Coordinates | null): boolean {
  if (!coords) return false;

  const { lat, lng } = coords;

  return (
    lat >= BAVARIA_BOUNDS.minLat &&
    lat <= BAVARIA_BOUNDS.maxLat &&
    lng >= BAVARIA_BOUNDS.minLng &&
    lng <= BAVARIA_BOUNDS.maxLng
  );
}

/**
 * Get a human-readable result of the Bavaria check
 * Useful for debugging and logging
 */
export function getBavariaCheckResult(coords: Coordinates | null): {
  isInside: boolean;
  message: string;
} {
  if (!coords) {
    return {
      isInside: false,
      message: "No coordinates provided",
    };
  }

  const isInside = isInsideBavaria(coords);

  if (isInside) {
    return {
      isInside: true,
      message: "Coordinates are inside Bavaria",
    };
  }

  // Determine which boundary was crossed for debugging
  const { lat, lng } = coords;
  const issues: string[] = [];

  if (lat < BAVARIA_BOUNDS.minLat) issues.push("too far south");
  if (lat > BAVARIA_BOUNDS.maxLat) issues.push("too far north");
  if (lng < BAVARIA_BOUNDS.minLng) issues.push("too far west");
  if (lng > BAVARIA_BOUNDS.maxLng) issues.push("too far east");

  return {
    isInside: false,
    message: `Coordinates are outside Bavaria (${issues.join(", ")})`,
  };
}

