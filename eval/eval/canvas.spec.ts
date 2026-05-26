/**
 * Atlas 5 — D9: Canvas mode Playwright spec
 *
 * Tests the canvas mode switch at browser level:
 * 1. Canvas button is present in header
 * 2. Clicking it switches to canvas mode (tldraw pane appears)
 * 3. tldraw container is visible
 * 4. Save button and exit button are present
 * 5. Exiting canvas returns to chat/artifact layout
 *
 * Prerequisites:
 *   - Next.js dev server at http://localhost:3000
 *   - Valid user session (test user cookie)
 *
 * Note: tldraw is lazy-loaded via next/dynamic. The selector waits account
 * for the dynamic import latency (up to 10s).
 *
 * Run: npx playwright test eval/canvas.spec.ts --config playwright.atlas5.config.ts
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gotoAtlas5(page: import("@playwright/test").Page) {
  await page.goto(`${BASE_URL}/atlas5`);
  await expect(page.locator('[data-testid="chat-pane"]')).toBeVisible({
    timeout: 15_000,
  });
}

async function enterCanvas(page: import("@playwright/test").Page) {
  const btn = page.locator('[data-testid="canvas-mode-button"]');
  await expect(btn).toBeVisible({ timeout: 5_000 });
  await btn.click();
  // Wait for canvas pane overlay
  await expect(page.locator('[data-testid="canvas-pane"]')).toBeVisible({
    timeout: 10_000,
  });
}

// ---------------------------------------------------------------------------
// D9 — Canvas mode switch
// ---------------------------------------------------------------------------

test.describe("D9 — Canvas mode (tldraw)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAtlas5(page);
  });

  test("canvas mode button visible in header", async ({ page }) => {
    await expect(
      page.locator('[data-testid="canvas-mode-button"]'),
    ).toBeVisible();
  });

  test("clicking canvas button shows canvas pane (full-screen overlay)", async ({
    page,
  }) => {
    await enterCanvas(page);
    await expect(page.locator('[data-testid="canvas-pane"]')).toBeVisible();
  });

  test("tldraw container renders after canvas mode enters", async ({
    page,
  }) => {
    await enterCanvas(page);
    // tldraw is lazy-loaded — allow extra time
    await expect(page.locator('[data-testid="tldraw-container"]')).toBeVisible({
      timeout: 15_000,
    });
  });

  test("save button is present in canvas toolbar", async ({ page }) => {
    await enterCanvas(page);
    await expect(
      page.locator('[data-testid="canvas-save-button"]'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("exit canvas button returns to chat layout", async ({ page }) => {
    await enterCanvas(page);

    // Exit canvas via the "← Exit Canvas" button (aria-label)
    const exitBtn = page.locator('button[aria-label="Exit canvas mode"]');
    await expect(exitBtn).toBeVisible({ timeout: 5_000 });
    await exitBtn.click();

    // Chat pane should reappear; canvas pane should disappear
    await expect(page.locator('[data-testid="chat-pane"]')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator('[data-testid="canvas-pane"]')).not.toBeVisible();
  });

  test("surface_state.json mode updates when entering canvas", async ({
    page,
  }) => {
    await enterCanvas(page);

    const state = await page.evaluate(() => {
      const raw = sessionStorage.getItem("surface_state.json");
      return raw ? JSON.parse(raw) : null;
    });

    expect(state).not.toBeNull();
    expect(state.mode).toBe("canvas");
  });

  test("surface_state.json mode reverts to chat after exiting", async ({
    page,
  }) => {
    await enterCanvas(page);

    const exitBtn = page.locator('button[aria-label="Exit canvas mode"]');
    await exitBtn.click();
    await expect(page.locator('[data-testid="chat-pane"]')).toBeVisible({
      timeout: 5_000,
    });

    const state = await page.evaluate(() => {
      const raw = sessionStorage.getItem("surface_state.json");
      return raw ? JSON.parse(raw) : null;
    });
    expect(state?.mode).toBe("chat");
  });
});
