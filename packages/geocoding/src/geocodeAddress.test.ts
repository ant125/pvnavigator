import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeAddress } from "./geocodeAddress";

type MockGoogleResult = {
  formatted_address: string;
  partial_match?: boolean;
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
    location_type?: string;
  };
  types?: string[];
};

function createPreciseGermanResult(
  overrides: Partial<MockGoogleResult> = {}
): MockGoogleResult {
  return {
    formatted_address: "Musterstraße 12, 86150 Augsburg, Germany",
    address_components: [
      {
        long_name: "12",
        short_name: "12",
        types: ["street_number"],
      },
      {
        long_name: "Musterstraße",
        short_name: "Musterstraße",
        types: ["route"],
      },
      {
        long_name: "86150",
        short_name: "86150",
        types: ["postal_code"],
      },
      {
        long_name: "Augsburg",
        short_name: "Augsburg",
        types: ["locality", "political"],
      },
      {
        long_name: "Germany",
        short_name: "DE",
        types: ["country", "political"],
      },
    ],
    geometry: {
      location: {
        lat: 48.3705,
        lng: 10.8978,
      },
      location_type: "ROOFTOP",
    },
    types: ["street_address"],
    ...overrides,
  };
}

function mockGoogleResponse(results: MockGoogleResult[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: "OK",
      results,
    }),
  });
}

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
    mockGoogleResponse([createPreciseGermanResult()]);

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

describe("geocodeAddress strict mode", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GOOGLE_SERVER_GEOCODE_KEY;
  const strictOptions = { requireExactAddress: true as const };

  beforeEach(() => {
    process.env.GOOGLE_SERVER_GEOCODE_KEY = "test-api-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GOOGLE_SERVER_GEOCODE_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it("accepts a full German street address with ROOFTOP precision", async () => {
    mockGoogleResponse([createPreciseGermanResult()]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", strictOptions)
    ).resolves.toEqual({
      latitude: 48.3705,
      longitude: 10.8978,
      formattedAddress: "Musterstraße 12, 86150 Augsburg, Germany",
    });
  });

  it("accepts a valid German interpolated address with RANGE_INTERPOLATED precision", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        geometry: {
          location: { lat: 48.3705, lng: 10.8978 },
          location_type: "RANGE_INTERPOLATED",
        },
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", strictOptions)
    ).resolves.toMatchObject({
      latitude: 48.3705,
      longitude: 10.8978,
    });
  });

  it("accepts postal_town instead of locality", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        address_components: [
          {
            long_name: "12",
            short_name: "12",
            types: ["street_number"],
          },
          {
            long_name: "Musterstraße",
            short_name: "Musterstraße",
            types: ["route"],
          },
          {
            long_name: "86150",
            short_name: "86150",
            types: ["postal_code"],
          },
          {
            long_name: "Augsburg",
            short_name: "Augsburg",
            types: ["postal_town", "political"],
          },
          {
            long_name: "Germany",
            short_name: "DE",
            types: ["country", "political"],
          },
        ],
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", strictOptions)
    ).resolves.toMatchObject({
      latitude: 48.3705,
      longitude: 10.8978,
    });
  });

  it("rejects a Rostock-like city-only result", async () => {
    mockGoogleResponse([
      {
        formatted_address: "Rostock, Germany",
        address_components: [
          {
            long_name: "Rostock",
            short_name: "Rostock",
            types: ["locality", "political"],
          },
          {
            long_name: "Germany",
            short_name: "DE",
            types: ["country", "political"],
          },
        ],
        geometry: {
          location: { lat: 54.0924, lng: 12.0991 },
          location_type: "APPROXIMATE",
        },
        types: ["locality", "political"],
      },
    ]);

    await expect(
      geocodeAddress("Fakestraße 99, 99999 Rostock, Deutschland", strictOptions)
    ).rejects.toMatchObject({
      name: "GeocodeError",
      geocodeStatus: "IMPRECISE_RESULT",
      message: "The address could not be resolved to a precise building location.",
    });
  });

  it("rejects partial_match === true", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        partial_match: true,
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", strictOptions)
    ).rejects.toMatchObject({
      geocodeStatus: "IMPRECISE_RESULT",
    });
  });

  it("rejects missing route", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        address_components: createPreciseGermanResult().address_components!.filter(
          (component) => !component.types.includes("route")
        ),
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", strictOptions)
    ).rejects.toMatchObject({
      geocodeStatus: "IMPRECISE_RESULT",
    });
  });

  it("rejects missing street_number", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        address_components: createPreciseGermanResult().address_components!.filter(
          (component) => !component.types.includes("street_number")
        ),
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", strictOptions)
    ).rejects.toMatchObject({
      geocodeStatus: "IMPRECISE_RESULT",
    });
  });

  it("rejects missing postal_code", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        address_components: createPreciseGermanResult().address_components!.filter(
          (component) => !component.types.includes("postal_code")
        ),
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", strictOptions)
    ).rejects.toMatchObject({
      geocodeStatus: "IMPRECISE_RESULT",
    });
  });

  it("rejects missing locality and postal_town", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        address_components: createPreciseGermanResult().address_components!.filter(
          (component) =>
            !component.types.includes("locality") &&
            !component.types.includes("postal_town")
        ),
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", strictOptions)
    ).rejects.toMatchObject({
      geocodeStatus: "IMPRECISE_RESULT",
    });
  });

  it("rejects country other than DE", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        address_components: createPreciseGermanResult().address_components!.map(
          (component) =>
            component.types.includes("country")
              ? {
                  long_name: "Austria",
                  short_name: "AT",
                  types: ["country", "political"],
                }
              : component
        ),
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Österreich", strictOptions)
    ).rejects.toMatchObject({
      geocodeStatus: "IMPRECISE_RESULT",
    });
  });

  it("rejects location_type GEOMETRIC_CENTER", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        geometry: {
          location: { lat: 48.3705, lng: 10.8978 },
          location_type: "GEOMETRIC_CENTER",
        },
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", strictOptions)
    ).rejects.toMatchObject({
      geocodeStatus: "IMPRECISE_RESULT",
    });
  });

  it("rejects location_type APPROXIMATE", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        geometry: {
          location: { lat: 48.3705, lng: 10.8978 },
          location_type: "APPROXIMATE",
        },
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", strictOptions)
    ).rejects.toMatchObject({
      geocodeStatus: "IMPRECISE_RESULT",
    });
  });

  it("rejects postal-code-only results", async () => {
    mockGoogleResponse([
      {
        formatted_address: "86150, Germany",
        address_components: [
          {
            long_name: "86150",
            short_name: "86150",
            types: ["postal_code"],
          },
          {
            long_name: "Germany",
            short_name: "DE",
            types: ["country", "political"],
          },
        ],
        geometry: {
          location: { lat: 48.3705, lng: 10.8978 },
          location_type: "APPROXIMATE",
        },
        types: ["postal_code", "political"],
      },
    ]);

    await expect(
      geocodeAddress("86150, Deutschland", strictOptions)
    ).rejects.toMatchObject({
      geocodeStatus: "IMPRECISE_RESULT",
    });
  });
});

describe("geocodeAddress expected postal code", () => {
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

  it("accepts a precise result when expectedPostalCode matches", async () => {
    mockGoogleResponse([createPreciseGermanResult()]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", {
        requireExactAddress: true,
        expectedPostalCode: "86150",
      })
    ).resolves.toMatchObject({
      latitude: 48.3705,
      longitude: 10.8978,
    });
  });

  it("normalizes whitespace in expectedPostalCode", async () => {
    mockGoogleResponse([createPreciseGermanResult()]);

    await expect(
      geocodeAddress("Musterstraße 12, 86150 Augsburg, Deutschland", {
        requireExactAddress: true,
        expectedPostalCode: " 86150 ",
      })
    ).resolves.toMatchObject({
      latitude: 48.3705,
      longitude: 10.8978,
    });
  });

  it("rejects when the resolved postal code differs from expectedPostalCode", async () => {
    mockGoogleResponse([createPreciseGermanResult()]);

    await expect(
      geocodeAddress("Musterstraße 12, 99999 Augsburg, Deutschland", {
        requireExactAddress: true,
        expectedPostalCode: "99999",
      })
    ).rejects.toMatchObject({
      name: "GeocodeError",
      geocodeStatus: "POSTAL_CODE_MISMATCH",
      message: "The resolved postal code does not match the entered postal code.",
    });
  });

  it("still accepts a precise result when expectedPostalCode is omitted", async () => {
    mockGoogleResponse([
      createPreciseGermanResult({
        address_components: createPreciseGermanResult().address_components!.map(
          (component) =>
            component.types.includes("postal_code")
              ? {
                  long_name: "86151",
                  short_name: "86151",
                  types: ["postal_code"],
                }
              : component
        ),
        formatted_address: "Musterstraße 12, 86151 Augsburg, Germany",
      }),
    ]);

    await expect(
      geocodeAddress("Musterstraße 12, 99999 Augsburg, Deutschland", {
        requireExactAddress: true,
      })
    ).resolves.toMatchObject({
      latitude: 48.3705,
      longitude: 10.8978,
      formattedAddress: "Musterstraße 12, 86151 Augsburg, Germany",
    });
  });
});

describe("geocodeAddress permissive mode", () => {
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

  it("still accepts a city-only result when requireExactAddress is omitted", async () => {
    mockGoogleResponse([
      {
        formatted_address: "Rostock, Germany",
        geometry: {
          location: { lat: 54.0924, lng: 12.0991 },
          location_type: "APPROXIMATE",
        },
        types: ["locality", "political"],
      },
    ]);

    await expect(geocodeAddress("Rostock, Deutschland")).resolves.toEqual({
      latitude: 54.0924,
      longitude: 12.0991,
      formattedAddress: "Rostock, Germany",
    });
  });

  it("still accepts a partial city-only result when requireExactAddress is false", async () => {
    mockGoogleResponse([
      {
        formatted_address: "Rostock, Germany",
        partial_match: true,
        geometry: {
          location: { lat: 54.0924, lng: 12.0991 },
          location_type: "APPROXIMATE",
        },
        types: ["locality", "political"],
      },
    ]);

    await expect(
      geocodeAddress("Fakestraße 99, 99999 Rostock, Deutschland", {
        requireExactAddress: false,
      })
    ).resolves.toEqual({
      latitude: 54.0924,
      longitude: 12.0991,
      formattedAddress: "Rostock, Germany",
    });
  });
});
