import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@pv-auth/session",
    "@geocoding/core",
    "@pvgis-adapter/core",
    "@bdew-profile/loader",
    "@pv-core/calculations",
    "@pv-methodology/registry",
    "@heatpump-profile/loader",
    "@ev-profile/loader",
  ],
  serverExternalPackages: ["@react-pdf/renderer", "fontkit"],
  outputFileTracingIncludes: {
    "/calculate": ["./data/wpuq/**/*"],
    "/api/calculate": ["./data/wpuq/**/*"],
    "/api/calculations/[id]/pdf": [
      "./src/pdf/assets/**/*",
      "./public/system-scene/base-house-no-label.png",
    ],
    "/methodik/[slug]": ["../../docs/public/methodik/examples/**/*"],
    "/methodik/examples/[file]": ["../../docs/public/methodik/examples/**/*"],
  },
};

export default nextConfig;
