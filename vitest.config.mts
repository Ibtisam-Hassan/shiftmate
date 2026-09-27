import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" } },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/integration/setup.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          fileParallelism: false, // one shared test database
        },
      },
    ],
  },
});
