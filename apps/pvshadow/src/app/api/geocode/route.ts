import { NextRequest, NextResponse } from "next/server";

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

    const apiKey = process.env.GOOGLE_SERVER_GEOCODE_KEY;
    if (!apiKey) {
      console.error("[geocode] GOOGLE_SERVER_GEOCODE_KEY is not set");
      return NextResponse.json(
        { status: "REQUEST_DENIED", error_message: "Server configuration error" },
        { status: 500 }
      );
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { status: "UNKNOWN_ERROR", error_message: "Geocoding request failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[geocode] Error:", error);
    return NextResponse.json(
      { status: "UNKNOWN_ERROR", error_message: "Internal server error" },
      { status: 500 }
    );
  }
}
