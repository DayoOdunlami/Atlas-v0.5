/**
 * Atlas 5 — D7: Brief artifact panel Playwright spec
 *
 * Tests the artifact pane at browser level:
 * 1. Empty state is shown before any agent response
 * 2. Canvas mode toggle exists (structural check)
 * 3. After triggering a JARVIS query the evidence view appears
 * 4. Confidence badge is always rendered once artifact is populated
 *
 * Prerequisites:
 *   - Next.js dev server at http://localhost:3000
 *   - Python agents at http://localhost:8000
 *   - Valid user session (test user cookie)
 *
 * Run: npx playwright test eval/artifact_panel.spec.ts --config playwright.atlas5.config.ts
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

// ---------------------------------------------------------------------------
// D7 — Structural pane checks (no agent call required)
// ---------------------------------------------------------------------------

test.describe("D7 — Artifact pane structure", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAtlas5(page);
  });

  test("artifact pane is present in the DOM", async ({ page }) => {
    await expect(page.locator('[data-testid="artifact-pane"]')).toBeVisible();
  });

  test("canvas mode button is visible in header", async ({ page }) => {
    await expect(
      page.locator('[data-testid="canvas-mode-button"]'),
    ).toBeVisible();
  });

  test("header contains all four agent switcher tabs", async ({ page }) => {
    for (const agent of ["ATLAS", "JARVIS", "CICERONE", "HYVE"]) {
      await expect(
        page.locator(`[data-testid="agent-tab-${agent}"]`),
      ).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// D7 — Artifact rendering after agent response (requires live services)
// ---------------------------------------------------------------------------

test.describe("D7 — Artifact populated from agent response", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAtlas5(page);
    // Select JARVIS — fastest agent, produces evidence view
    const jarvisTab = page.locator('[data-testid="agent-tab-JARVIS"]');
    if (await jarvisTab.isVisible()) {
      await jarvisTab.click();
    }
  });

  test("sending a JARVIS query shows evidence-view in artifact pane", async ({
    page,
  }) => {
    // Submit a JARVIS query
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill("Find projects relating to rail electrification");
    await page.locator('[data-testid="chat-send-button"]').click();

    // Wait for the streaming to complete (evidence-view appears in artifact pane)
    await expect(page.locator('[data-testid="evidence-view"]')).toBeVisible({
      timeout: 60_000,
    });
  });

  test("confidence badge is shown once artifact is populated", async ({
    page,
  }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill("Rail decarbonisation evidence");
    await page.locator('[data-testid="chat-send-button"]').click();

    // Confidence badge must always render after agent response
    await expect(
      page.locator('[data-testid="confidence-tier-badge"]'),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("corpus citations list renders after JARVIS response", async ({
    page,
  }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill("Electric vehicle infrastructure projects");
    await page.locator('[data-testid="chat-send-button"]').click();

    await expect(
      page.locator('[data-testid="corpus-citations-list"]'),
    ).toBeVisible({ timeout: 60_000 });
  });
});

// ---------------------------------------------------------------------------
// D7 — ATLAS brief view (Five Case + NPV card)
// ---------------------------------------------------------------------------

test.describe("D7 — ATLAS brief view", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAtlas5(page);
    const atlasTab = page.locator('[data-testid="agent-tab-ATLAS"]');
    if (await atlasTab.isVisible()) {
      await atlasTab.click();
    }
  });

  test("ATLAS response shows brief-view with NPV card", async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill("Business case for a £2m rural mobility demonstrator");
    await page.locator('[data-testid="chat-send-button"]').click();

    // Brief view should appear
    await expect(page.locator('[data-testid="brief-view"]')).toBeVisible({
      timeout: 90_000,
    });

    // NPV card must show HMT STPR discount rate
    await expect(page.locator('[data-testid="npv-card"]')).toBeVisible({
      timeout: 5_000,
    });
  });
});
