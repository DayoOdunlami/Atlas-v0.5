/**
 * Atlas 5 — D1 Surface Gateway E2E spec (Playwright)
 *
 * Tests that the three-pane shell renders correctly and the surface gateway
 * emits valid state on agent/lens switches.
 *
 * Run: npm run eval:tier1:e2e
 * Requires: dev server running at http://localhost:3000
 *
 * Note: These tests require an authenticated session. The beforeEach sets up
 * session storage or relies on a pre-seeded test user cookie. In CI the
 * NEXT_PUBLIC_BASE_URL env var points at the test deployment.
 */
import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to /atlas5 and wait for the shell to be hydrated */
async function gotoAtlas5(page: import("@playwright/test").Page) {
  await page.goto("/atlas5");
  // Wait for the chat pane to appear (confirms React hydration)
  await page.waitForSelector('[data-testid="chat-pane"]', { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// D1 — Shell structure
// ---------------------------------------------------------------------------

test.describe("D1 — Next.js shell structure", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAtlas5(page);
  });

  test("chat pane renders [data-testid='chat-pane']", async ({ page }) => {
    await expect(page.locator('[data-testid="chat-pane"]')).toBeVisible();
  });

  test("artifact pane renders [data-testid='artifact-pane']", async ({
    page,
  }) => {
    await expect(page.locator('[data-testid="artifact-pane"]')).toBeVisible();
  });

  test("all four agent switchers visible (ATLAS, JARVIS, CICERONE, HYVE)", async ({
    page,
  }) => {
    for (const agent of ["ATLAS", "JARVIS", "CICERONE", "HYVE"]) {
      await expect(page.locator(`[data-agent="${agent}"]`)).toBeVisible();
    }
  });

  test("lens selector visible (CPC, Atlas, Ecosystem, Funder, Mode)", async ({
    page,
  }) => {
    for (const lens of ["CPC", "Atlas", "Ecosystem", "Funder", "Mode"]) {
      await expect(page.locator(`[data-lens="${lens}"]`)).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// D1 — Surface gateway
// ---------------------------------------------------------------------------

test.describe("D1 — Surface gateway hook", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAtlas5(page);
  });

  test("surface_state.json emitted with correct shape on page load", async ({
    page,
  }) => {
    const raw = await page.evaluate(() =>
      window.sessionStorage.getItem("surface_state.json"),
    );
    expect(raw).not.toBeNull();

    const state = JSON.parse(raw as string);
    expect(["ATLAS", "JARVIS", "CICERONE", "HYVE"]).toContain(
      state.active_agent,
    );
    expect(["CPC", "Atlas", "Ecosystem", "Funder", "Mode"]).toContain(
      state.active_lens,
    );
    expect(typeof state.timestamp).toBe("string");
    // thread_id is null at page load (no conversation started yet)
    expect(state.thread_id).toBeNull();
  });

  test("switching agent updates surface_state.json", async ({ page }) => {
    // Click JARVIS tab
    await page.locator('[data-agent="JARVIS"]').click();

    const raw = await page.evaluate(() =>
      window.sessionStorage.getItem("surface_state.json"),
    );
    const state = JSON.parse(raw as string);
    expect(state.active_agent).toBe("JARVIS");
  });

  test("switching lens updates surface_state.json", async ({ page }) => {
    // Click Ecosystem lens
    await page.locator('[data-lens="Ecosystem"]').click();

    const raw = await page.evaluate(() =>
      window.sessionStorage.getItem("surface_state.json"),
    );
    const state = JSON.parse(raw as string);
    expect(state.active_lens).toBe("Ecosystem");
  });
});
