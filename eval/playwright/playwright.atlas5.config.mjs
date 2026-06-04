import { defineConfig, devices } from "@playwright/test";

/**
 * Atlas 5 Playwright — fixture smoke + authenticated live agent paths.
 * Default base URL matches `npm run dev` (port 3005).
 */
export default defineConfig({
  globalSetup: "./global-setup.mjs",
  testDir: ".",
  testMatch: ["**/*.spec.ts"],
  timeout: 180_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3005",
    ...devices["Desktop Chrome"],
    viewport: { width: 1400, height: 900 },
    trace: "retain-on-failure",
    actionTimeout: 30_000,
  },
});
