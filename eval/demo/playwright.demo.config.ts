import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const recordingsDir = path.join(__dirname, "recordings");

export default defineConfig({
  testDir: __dirname,
  testMatch: "record-surface-demo.spec.ts",
  timeout: 600_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: path.join(recordingsDir, "playwright-report") }]],
  use: {
    baseURL: process.env.DEMO_BASE_URL ?? "http://localhost:3005",
    ...devices["Desktop Chrome"],
    viewport: { width: 1600, height: 900 },
    video: {
      mode: "on",
      size: { width: 1600, height: 900 },
    },
    trace: "off",
    actionTimeout: 30_000,
  },
  outputDir: path.join(recordingsDir, "test-results"),
});
