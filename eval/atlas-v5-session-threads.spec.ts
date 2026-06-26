/**
 * Atlas v5 session persistence — sidebar + thread API smoke.
 * Run: npx vitest run eval/atlas-v5-threads.test.ts
 * E2E: npx playwright test eval/atlas-v5-session-threads.spec.ts --config eval/playwright.atlas-v5.config.ts
 */
import { expect, test } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3005";

test.describe("Atlas v5 session threads UI", () => {
  test("session page exposes history expand control", async ({ page }) => {
    await page.goto(`${BASE}/atlas/session?thread=00000000-0000-4000-8000-000000000001`);
    await expect(page.getByTestId("atlas-history-expand")).toBeVisible({
      timeout: 15_000,
    });
  });
});
