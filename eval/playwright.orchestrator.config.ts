import { defineConfig, devices } from "@playwright/test";

/**
 * Orchestrator / MVP gate Playwright config.
 *
 * Prerequisites (local):
 *   npm run dev:ui        → :3005
 *   npm run dev:agents    → :8000
 *   ATLAS5_ORCHESTRATOR_V1=true
 *   NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1=true
 */
export default defineConfig({
  testDir: ".",
  testMatch: ["orchestrator_workbench.spec.ts", "mvp_gate.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 90_000 },
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3005",
    ...devices["Desktop Chrome"],
  },
  reporter: [["list"]],
});
