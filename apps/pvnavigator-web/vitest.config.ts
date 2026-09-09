import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@pv-auth/session": path.resolve(
        __dirname,
        "../../packages/auth-session/src/index.ts",
      ),
    },
  },
});
