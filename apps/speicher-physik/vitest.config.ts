import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
      "@": path.resolve(__dirname, "src"),
      "@heatpump-profile/loader": path.resolve(
        __dirname,
        "../../packages/heatpump-profile/src/index.ts"
      ),
    },
  },
});
