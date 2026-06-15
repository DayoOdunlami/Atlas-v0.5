/**
 * U11 — Orchestrator workbench Playwright e2e.
 *
 * Prerequisites:
 *   NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1=true
 *   ATLAS5_ORCHESTRATOR_V1=true on Python agents (:8000)
 *   Next.js dev server (:3000 or :3005)
 *
 * Run:
 *   npx playwright test eval/orchestrator_workbench.spec.ts
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const CANONICAL =
  "What evidence does CPC have in smart mobility that would transfer to the Innovate UK Smart City Challenge?";

test.describe("U11 — Orchestrator workbench e2e", () => {
  test.skip(
    process.env.NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1 !== "true",
    "Set NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1=true to run",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/workbench`);
    await page.waitForLoadState("networkidle");
  });

  test("workbench loads orchestrator chat panel", async ({ page }) => {
    await expect(page.getByText("orchestrator")).toBeVisible({ timeout: 15_000 });
  });

  test("canonical question updates canvas with transfer blocks", async ({ page }) => {
    test.setTimeout(120_000);

    const input = page.locator("textarea").first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.fill(CANONICAL);
    await input.press("Enter");

    await expect(page.getByText(/transfer|TransferLanes|Four-lane/i).first()).toBeVisible({
      timeout: 90_000,
    });

    await expect(page.getByText(/MatchBench|Evidence map|FIT|GAP/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByText(/Indicative|Supported|Robust|Speculative/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
