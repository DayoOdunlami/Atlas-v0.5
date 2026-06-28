/**
 * Atlas v5 session persistence — sidebar + thread API smoke.
 * Run: npx vitest run eval/atlas-v5-threads.test.ts
 * E2E: npx playwright test eval/atlas-v5-session-threads.spec.ts --config eval/playwright.atlas-v5.config.ts
 */
import { expect, test } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3005";

test.describe("Atlas v5 session threads UI", () => {
  test("session page exposes hover session rail", async ({ page }) => {
    await page.goto(`${BASE}/atlas?thread=00000000-0000-4000-8000-000000000001`);
    const rail = page.getByTestId("atlas-session-rail");
    await expect(rail).toBeAttached({ timeout: 15_000 });
    await expect(rail).toHaveAttribute("data-expanded", "false");
    await rail.hover();
    await expect(rail).toHaveAttribute("data-expanded", "true", { timeout: 2_000 });
  });
});
