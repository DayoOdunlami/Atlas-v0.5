/**
 * Atlas 5 — D6: AG-UI wiring Playwright spec
 *
 * Tests that the chat pane is correctly wired to /api/copilotkit
 * and that:
 * 1. Sending a message triggers a POST to /api/copilotkit
 * 2. The response streams into the message list (no page refresh)
 * 3. Surface state updates reflect the active agent
 *
 * Prerequisites:
 *   - Next.js dev server running on http://localhost:3000
 *   - User session (requires valid auth; use a test user)
 *
 * Run: npx playwright test eval/agui_wiring.spec.ts
 */
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test.describe("D6 — AG-UI wiring", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Atlas 5 shell
    await page.goto(`${BASE_URL}/atlas5`);
    // Wait for chat pane to mount
    await expect(page.locator('[data-testid="chat-pane"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test("chat pane has input and send button", async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    const button = page.locator('[data-testid="chat-send-button"]');
    await expect(input).toBeVisible();
    await expect(button).toBeVisible();
    // Send button disabled when input is empty
    await expect(button).toBeDisabled();
  });

  test("sending a chat message triggers POST to /api/copilotkit", async ({
    page,
  }) => {
    // Intercept requests to /api/copilotkit
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/copilotkit") && req.method() === "POST",
      { timeout: 15_000 },
    );

    // Type a message and submit
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill(
      "What innovation projects relate to rail decarbonisation?",
    );
    await page.locator('[data-testid="chat-send-button"]').click();

    // Verify the request was made
    const req = await requestPromise;
    const body = JSON.parse(req.postData() ?? "{}");
    expect(body).toHaveProperty("messages");
    expect(body).toHaveProperty("active_agent");
    expect(["ATLAS", "JARVIS", "CICERONE", "HYVE"]).toContain(
      body.active_agent,
    );
  });

  test("response streams into message list without page refresh", async ({
    page,
  }) => {
    // Track navigation (page refresh would trigger this)
    let didNavigate = false;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) didNavigate = true;
    });

    const input = page.locator('[data-testid="chat-input"]');
    await input.fill(
      "Summarise the connected and autonomous vehicles portfolio",
    );
    await page.locator('[data-testid="chat-send-button"]').click();

    // User message should appear immediately
    await expect(
      page.locator('[data-testid="message-user"]').first(),
    ).toBeVisible({ timeout: 5_000 });

    // Streaming indicator or assistant message should appear within 10s
    await expect(
      page
        .locator(
          '[data-testid="streaming-indicator"], [data-testid="message-assistant"]',
        )
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    // No page refresh occurred
    expect(didNavigate).toBe(false);
  });

  test("active agent label updates when switching agent", async ({ page }) => {
    const label = page.locator('[data-testid="active-agent-label"]');

    // Default agent shown in label
    const initialAgent = await label.textContent();
    expect(["ATLAS", "JARVIS", "CICERONE", "HYVE"]).toContain(
      initialAgent?.trim(),
    );

    // Switch to ATLAS (if not already)
    const atlasTab = page.locator('[data-testid="agent-tab-ATLAS"]');
    if (await atlasTab.isVisible()) {
      await atlasTab.click();
      await expect(label).toHaveText("ATLAS", { timeout: 2_000 });
    }

    // Switch to JARVIS
    const jarvisTab = page.locator('[data-testid="agent-tab-JARVIS"]');
    if (await jarvisTab.isVisible()) {
      await jarvisTab.click();
      await expect(label).toHaveText("JARVIS", { timeout: 2_000 });
    }
  });

  test("surface_state.json active_agent updates on agent switch", async ({
    page,
  }) => {
    // Switch to ATLAS
    const atlasTab = page.locator('[data-testid="agent-tab-ATLAS"]');
    if (await atlasTab.isVisible()) {
      await atlasTab.click();
    }

    // Check sessionStorage
    const state = await page.evaluate(() => {
      const raw = sessionStorage.getItem("surface_state.json");
      return raw ? JSON.parse(raw) : null;
    });
    expect(state).not.toBeNull();
    expect(state.active_agent).toBe("ATLAS");
  });
});
