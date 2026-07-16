import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    restoreMocks: true,
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["packages/**/*.test.ts", "apps/**/*.{test,spec}.ts", "tests/contracts/**/*.test.ts"],
          exclude: ["apps/lab-console/**/*.test.tsx"]
        }
      },
      {
        test: {
          name: "console",
          environment: "jsdom",
          include: ["apps/lab-console/**/*.test.tsx"]
        }
      }
    ]
  }
});
