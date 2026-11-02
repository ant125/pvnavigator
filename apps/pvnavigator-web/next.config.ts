import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pv-auth/session", "@pv-access/core"],
};

export default nextConfig;
