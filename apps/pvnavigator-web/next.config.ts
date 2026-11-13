import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pv-auth/session", "@pv-access/core"],
  async redirects() {
    return [
      { source: "/tarife", destination: "/", permanent: false },
      { source: "/tarife/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
