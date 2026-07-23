import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@geocoding/core",
    "@pvgis-adapter/core",
    "@bdew-profile/loader",
    "@pv-core/calculations",
  ],
};

export default nextConfig;
