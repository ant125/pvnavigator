const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

const PRECISE_LOCATION_TYPES = new Set(["ROOFTOP", "RANGE_INTERPOLATED"]);

const STREET_LEVEL_RESULT_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
  "establishment",
  "route",
]);

const APPROXIMATE_ONLY_RESULT_TYPES = new Set([
  "locality",
  "postal_code",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "administrative_area_level_4",
  "political",
  "country",
]);

export type GeocodeAddressResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

export type GeocodeAddressOptions = {
  requireExactAddress?: boolean;
  expectedPostalCode?: string;
};

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResult = {
  formatted_address: string;
  partial_match?: boolean;
  address_components?: GoogleAddressComponent[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
    location_type?: string;
  };
  types?: string[];
};

type GoogleGeocodeResponse = {
  status: string;
  error_message?: string;
  results?: GoogleGeocodeResult[];
};

function createGeocodeError(status: string, message: string): Error {
  const error = new Error(message);
  error.name = "GeocodeError";
  Object.assign(error, { geocodeStatus: status });
  return error;
}

function findAddressComponent(
  components: GoogleAddressComponent[],
  type: string
): GoogleAddressComponent | undefined {
  return components.find((component) => component.types.includes(type));
}

function hasAddressComponent(
  components: GoogleAddressComponent[],
  type: string
): boolean {
  return findAddressComponent(components, type) !== undefined;
}

function isAdministrativeOnlyResult(types: string[]): boolean {
  const hasStreetLevel = types.some((type) =>
    STREET_LEVEL_RESULT_TYPES.has(type)
  );
  if (hasStreetLevel) {
    return false;
  }

  return types.some((type) => APPROXIMATE_ONLY_RESULT_TYPES.has(type));
}

function validateExactAddressResult(result: GoogleGeocodeResult): void {
  if (result.partial_match === true) {
    throw createGeocodeError(
      "IMPRECISE_RESULT",
      "The address could not be resolved to a precise building location."
    );
  }

  const components = result.address_components ?? [];
  const country = findAddressComponent(components, "country");

  if (!country) {
    throw createGeocodeError(
      "IMPRECISE_RESULT",
      "The address could not be resolved to a precise building location."
    );
  }

  if (country.short_name !== "DE") {
    throw createGeocodeError(
      "IMPRECISE_RESULT",
      "The address could not be resolved to a precise building location."
    );
  }

  if (!hasAddressComponent(components, "route")) {
    throw createGeocodeError(
      "IMPRECISE_RESULT",
      "The address could not be resolved to a precise building location."
    );
  }

  if (!hasAddressComponent(components, "street_number")) {
    throw createGeocodeError(
      "IMPRECISE_RESULT",
      "The address could not be resolved to a precise building location."
    );
  }

  if (!hasAddressComponent(components, "postal_code")) {
    throw createGeocodeError(
      "IMPRECISE_RESULT",
      "The address could not be resolved to a precise building location."
    );
  }

  if (
    !hasAddressComponent(components, "locality") &&
    !hasAddressComponent(components, "postal_town")
  ) {
    throw createGeocodeError(
      "IMPRECISE_RESULT",
      "The address could not be resolved to a precise building location."
    );
  }

  const locationType = result.geometry.location_type;
  if (!locationType || !PRECISE_LOCATION_TYPES.has(locationType)) {
    throw createGeocodeError(
      "IMPRECISE_RESULT",
      "The address could not be resolved to a precise building location."
    );
  }

  const types = result.types ?? [];
  if (isAdministrativeOnlyResult(types)) {
    throw createGeocodeError(
      "IMPRECISE_RESULT",
      "The address could not be resolved to a precise building location."
    );
  }
}

function validateExpectedPostalCode(
  result: GoogleGeocodeResult,
  expectedPostalCode: string
): void {
  const postalCodeComponent = findAddressComponent(
    result.address_components ?? [],
    "postal_code"
  );

  if (!postalCodeComponent) {
    throw createGeocodeError(
      "IMPRECISE_RESULT",
      "The address could not be resolved to a precise building location."
    );
  }

  const resolvedPostalCode = postalCodeComponent.long_name.trim();
  const normalizedExpectedPostalCode = expectedPostalCode.trim();

  if (resolvedPostalCode !== normalizedExpectedPostalCode) {
    throw createGeocodeError(
      "POSTAL_CODE_MISMATCH",
      "The resolved postal code does not match the entered postal code."
    );
  }
}

function toGeocodeAddressResult(result: GoogleGeocodeResult): GeocodeAddressResult {
  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

export async function geocodeAddress(
  address: string,
  options?: GeocodeAddressOptions
): Promise<GeocodeAddressResult> {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw createGeocodeError("INVALID_REQUEST", "Address is required");
  }

  const apiKey = process.env.GOOGLE_SERVER_GEOCODE_KEY;
  if (!apiKey) {
    throw createGeocodeError("REQUEST_DENIED", "Server configuration error");
  }

  const url = new URL(GOOGLE_GEOCODE_URL);
  url.searchParams.set("address", trimmedAddress);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  const data = (await res.json()) as GoogleGeocodeResponse;

  if (!res.ok) {
    throw createGeocodeError("UNKNOWN_ERROR", "Geocoding request failed");
  }

  if (data.status === "OK" && data.results?.[0]) {
    const result = data.results[0];

    if (options?.requireExactAddress === true) {
      validateExactAddressResult(result);

      if (options.expectedPostalCode !== undefined) {
        validateExpectedPostalCode(result, options.expectedPostalCode);
      }
    }

    return toGeocodeAddressResult(result);
  }

  throw createGeocodeError(
    data.status || "UNKNOWN_ERROR",
    data.error_message ?? data.status ?? "Geocoding failed"
  );
}
