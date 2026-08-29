import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Multi-year alignment fixtures (2006–2020) are CPU-heavy.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
