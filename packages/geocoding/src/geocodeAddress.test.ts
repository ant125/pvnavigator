import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeAddress } from "./geocodeAddress";

describe("geocodeAddress", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GOOGLE_SERVER_GEOCODE_KEY;

  beforeEach(() => {
    process.env.GOOGLE_SERVER_GEOCODE_KEY = "test-api-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GOOGLE_SERVER_GEOCODE_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it("returns coordinates for a successful geocoding response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [
          {
            formatted_address: "Musterstraße 12, 86150 Augsburg, Germany",
            geometry: {
              location: {
                lat: 48.3705,
                lng: 10.8978,
              },
            },
          },
        ],
      }),
    });

    await expect(geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland")).resolves.toEqual({
      latitude: 48.3705,
      longitude: 10.8978,
      formattedAddress: "Musterstraße 12, 86150 Augsburg, Germany",
    });
  });

  it("throws ZERO_RESULTS when Google returns no matches", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ZERO_RESULTS",
        results: [],
      }),
    });

    await expect(geocodeAddress("Unknown Place 99999")).rejects.toMatchObject({
      name: "GeocodeError",
      geocodeStatus: "ZERO_RESULTS",
    });
  });

  it("throws Google API errors from the response body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "REQUEST_DENIED",
        error_message: "The provided API key is invalid.",
      }),
    });

    await expect(geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland")).rejects.toMatchObject({
      name: "GeocodeError",
      geocodeStatus: "REQUEST_DENIED",
      message: "The provided API key is invalid.",
    });
  });

  it("throws UNKNOWN_ERROR when the HTTP request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        status: "UNKNOWN_ERROR",
      }),
    });

    await expect(geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland")).rejects.toMatchObject({
      name: "GeocodeError",
      geocodeStatus: "UNKNOWN_ERROR",
      message: "Geocoding request failed",
    });
  });
});
