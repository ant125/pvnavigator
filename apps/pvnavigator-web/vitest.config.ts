import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "server-only": path.resolve(
        __dirname,
        "../../node_modules/next/dist/compiled/server-only/empty.js",
      ),
      "@": path.resolve(__dirname, "src"),
      "@pv-auth/session": path.resolve(
        __dirname,
        "../../packages/auth-session/src/index.ts",
      ),
      "@pv-access/core": path.resolve(
        __dirname,
        "../../packages/pv-access/src/index.ts",
      ),
    },
  },
});
