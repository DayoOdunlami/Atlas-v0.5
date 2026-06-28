import { defineConfig, devices } from "@playwright/test";

/**
 * Atlas v5 /atlas practitioner session E2E.
 *
 * Prerequisites:
 *   npm run dev          → UI :3005 + agents :8000
 *   ANTHROPIC_API_KEY    → live turns
 *
 * Skip: SKIP_V5_E2E=1
 */
export default defineConfig({
  testDir: "./playwright",
  testMatch: ["atlas-v5-session.spec.ts", "atlas-v5-workbench.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 360_000,
  expect: { timeout: 120_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3005",
    ...devices["Desktop Chrome"],
  },
  reporter: [["list"]],
});
