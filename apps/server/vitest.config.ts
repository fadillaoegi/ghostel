import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // All server test files share one real PostgreSQL database.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
