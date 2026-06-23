import { expect, test } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3005";

test.describe("Atlas v5 /atlas surface", () => {
  test("renders J1T1 and follow-up input accepts text", async ({ page }) => {
    await page.goto(`${BASE}/atlas`);
    await expect(page.locator('[data-testid="atlas-surface-root"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-testid="incommensurable-magnitudes"]')).toBeVisible();
    const input = page.locator('[data-testid="atlas-follow-up-input"]');
    await expect(input).toBeEditable();
    await input.fill("What about TRIG grants?");
    await expect(input).toHaveValue("What about TRIG grants?");
    await input.press("Enter");
    await expect(page.getByText("What about TRIG grants?", { exact: true })).toBeVisible();
  });
});
