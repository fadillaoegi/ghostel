import { defineConfig } from "vitest/config";

// TEST_DATABASE_URL (with the database password) comes from .env when it is not already set.
try {
  process.loadEnvFile("../../.env");
} catch {
  // No .env: test/helpers.ts falls back to its default URL.
}

export default defineConfig({
  test: {
    // All server test files share one real PostgreSQL database.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
