import { geocodeAddress } from "@geocoding/core";
import { NextRequest, NextResponse } from "next/server";

function getGeocodeStatus(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "geocodeStatus" in error &&
    typeof (error as { geocodeStatus: unknown }).geocodeStatus === "string"
  ) {
    return (error as { geocodeStatus: string }).geocodeStatus;
  }

  return null;
}

function httpStatusForGeocode(status: string, message: string): number {
  if (status === "INVALID_REQUEST") {
    return 400;
  }

  if (status === "REQUEST_DENIED" && message === "Server configuration error") {
    return 500;
  }

  if (status === "UNKNOWN_ERROR" && message === "Geocoding request failed") {
    return 502;
  }

  return 200;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const address = typeof body?.address === "string" ? body.address.trim() : "";

    if (!address) {
      return NextResponse.json(
        { status: "INVALID_REQUEST", error_message: "Address is required" },
        { status: 400 }
      );
    }

    try {
      const result = await geocodeAddress(address);

      return NextResponse.json({
        status: "OK",
        results: [
          {
            formatted_address: result.formattedAddress,
            geometry: {
              location: {
                lat: result.latitude,
                lng: result.longitude,
              },
            },
          },
        ],
      });
    } catch (error) {
      const status = getGeocodeStatus(error) ?? "UNKNOWN_ERROR";
      const error_message =
        error instanceof Error ? error.message : "Internal server error";

      if (status === "REQUEST_DENIED" && error_message === "Server configuration error") {
        console.error("[geocode] GOOGLE_SERVER_GEOCODE_KEY is not set");
      }

      return NextResponse.json(
        { status, error_message },
        { status: httpStatusForGeocode(status, error_message) }
      );
    }
  } catch (error) {
    console.error("[geocode] Error:", error);
    return NextResponse.json(
      { status: "UNKNOWN_ERROR", error_message: "Internal server error" },
      { status: 500 }
    );
  }
}
