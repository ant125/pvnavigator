const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export type GeocodeAddressResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

type GoogleGeocodeResponse = {
  status: string;
  error_message?: string;
  results?: Array<{
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
};

function createGeocodeError(status: string, message: string): Error {
  const error = new Error(message);
  error.name = "GeocodeError";
  Object.assign(error, { geocodeStatus: status });
  return error;
}

export async function geocodeAddress(
  address: string
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
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    };
  }

  throw createGeocodeError(
    data.status || "UNKNOWN_ERROR",
    data.error_message ?? data.status ?? "Geocoding failed"
  );
}
