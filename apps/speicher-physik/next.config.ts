import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@geocoding/core",
    "@pvgis-adapter/core",
    "@bdew-profile/loader",
    "@pv-core/calculations",
    "@pv-methodology/registry",
    "@heatpump-profile/loader",
    "@ev-profile/loader",
  ],
  outputFileTracingIncludes: {
    "/calculate": ["./data/wpuq/**/*"],
    "/api/calculate": ["./data/wpuq/**/*"],
  },
};

export default nextConfig;
