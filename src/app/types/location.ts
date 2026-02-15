/**
 * Location Types for PVNavigator
 * 
 * These types ensure proper tracking of the geographic point
 * that serves as the foundation for all PV calculations.
 */

/**
 * Source of the location coordinates
 * - "geocode": Initial coordinates from address geocoding (preliminary, not yet confirmed)
 * - "user_marker": Final coordinates from user-confirmed map marker position (source of truth)
 */
export type LocationSource = "geocode" | "user_marker";

/**
 * Geographic coordinates
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Confirmed location that serves as the single source of truth
 * for all downstream PV calculations (DOM tiles, roof geometry, shading, yield, economics).
 * 
 * CRITICAL RULE:
 * Once `confirmed` is true and `source` is "user_marker",
 * these coordinates must NOT be overwritten by geocoding or autocomplete.
 */
export interface ConfirmedLocation {
  /** Latitude and longitude of the marker */
  coordinates: Coordinates;
  
  /** How the coordinates were determined */
  source: LocationSource;
  
  /** 
   * Whether the user has explicitly confirmed this position
   * When true, this marks the end of the address-selection phase
   */
  confirmed: boolean;
  
  /** ISO timestamp when the location was confirmed */
  confirmedAt?: string;
}

/**
 * Address form data (German format for Bavaria)
 */
export interface AddressForm {
  /** Postleitzahl (postal code) */
  plz: string;
  /** Ort (city/town) */
  ort: string;
  /** Straße (street name) */
  strasse: string;
  /** Hausnummer (house number) */
  hausnummer: string;
}

/**
 * Create a confirmed location object from marker coordinates.
 * This is the ONLY way to create a source-of-truth location.
 */
export function createConfirmedLocation(coords: Coordinates): ConfirmedLocation {
  return {
    coordinates: { ...coords },
    source: "user_marker",
    confirmed: true,
    confirmedAt: new Date().toISOString(),
  };
}

/**
 * Create a preliminary location from geocoding.
 * This location is NOT confirmed and will be replaced when user confirms marker.
 */
export function createGeocodedLocation(coords: Coordinates): ConfirmedLocation {
  return {
    coordinates: { ...coords },
    source: "geocode",
    confirmed: false,
  };
}

