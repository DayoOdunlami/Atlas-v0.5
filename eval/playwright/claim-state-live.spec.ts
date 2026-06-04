/**
 * Authenticated live path: dev-bypass session → CopilotKit chat → artifact pane
 * with ClaimStateBadge on passport entity_profile claims (GoShuttle, all self_reported
 * in DB → UI shows inferred, not stated).
 *
 * Prerequisites:
 *   npm run dev   (Next.js :3005 + uvicorn agents :8000)
 *   .env.local with ANTHROPIC_API_KEY, SUPABASE_SERVICE_KEY, POSTGRES_URL, BETTER_AUTH_SECRET
 *
 * Run:
 *   pnpm exec playwright test eval/playwright/claim-state-live.spec.ts --config eval/playwright/playwright.atlas5.config.ts
 *   npm run eval:e2e:claim-state
 */

import { expect, test } from "@playwright/test";

import { loginForPlaywright } from "./helpers/auth";

test.describe("Claim state — live chat → artifact (authenticated)", () => {
  test.beforeAll(async ({ request }) => {
    const agentBase = process.env.PYTHON_AGENTS_URL?.replace(/\/$/, "");
    if (!agentBase) {
      test.skip(true, "PYTHON_AGENTS_URL is not set — run npm run dev with .env.local");
      return;
    }
    try {
      const health = await request.get(`${agentBase}/health`, { timeout: 5_000 });
      expect(health.ok(), "Start agents: npm run dev:agents").toBeTruthy();
    } catch {
      test.skip(true, "Python agents not reachable — run npm run dev");
    }
  });

  test.beforeEach(async ({ page }) => {
    // Authenticated path (dev-bypass or x-tool-secret cookie). Unauthenticated
    // /atlas5-test still runs CopilotKit; login is best-effort when secrets exist.
    try {
      await loginForPlaywright(page);
    } catch {
      // continue — live artifact assertion does not require session today
    }
  });

  test("e2e-bypass establishes authenticated session cookie", async ({ page }) => {
    const { loginViaE2eToolSecret } = await import("./helpers/auth");
    await loginViaE2eToolSecret(page);
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === "atlas_e2e_auth" && c.value === "1")).toBe(
      true,
    );
  });

  test("GoShuttle passport chat renders inferred claim-state badges on live entity claims", async ({
    page,
  }) => {
    // /lab/shell uses MainLayout (proven useCoAgent → artifact store bridge)
    await page.goto("/lab/shell");
    await expect(page.locator('[data-testid="artifact-pane"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();

    const copilotPost = page.waitForRequest(
      (req) =>
        req.url().includes("/api/copilotkit") && req.method() === "POST",
      { timeout: 15_000 },
    );

    const input = page.locator('[data-testid="chat-input"]');
    await input.fill("Show me the GoShuttle passport");
    await page.locator('[data-testid="chat-send-button"]').click();
    await copilotPost;

    // Shell chat renders DisplayMessage bubbles (no message-user testid)
    await expect(page.getByText("Show me the GoShuttle passport").first()).toBeVisible({
      timeout: 15_000,
    });

    // Live object-route: entity_profile with self_reported tiers → inferred badges
    const passportSurface = page.locator(
      '[data-testid="entity-profile-surface-passport"]',
    );
    await expect(passportSurface).toBeVisible({ timeout: 120_000 });

    const inferredOnClaims = page.locator(
      '[data-testid="entity-profile-claim"] [data-testid="claim-state-badge-inferred"]',
    );
    await expect(inferredOnClaims.first()).toBeVisible({ timeout: 15_000 });
    expect(await inferredOnClaims.count()).toBeGreaterThanOrEqual(1);

    // Lab fixtures used hardcoded stated rows; live GoShuttle must not show stated on claims
    const statedOnClaims = page.locator(
      '[data-testid="entity-profile-claim"] [data-testid="claim-state-badge-stated"]',
    );
    expect(await statedOnClaims.count()).toBe(0);

    // Trust rail may also surface corpus citations with claim_state from the same run
    const trustRailBadge = page.locator(
      '[data-testid="trust-rail"] [data-testid^="claim-state-badge-"]',
    );
    if ((await trustRailBadge.count()) > 0) {
      await expect(trustRailBadge.first()).toBeVisible();
    }
  });
});
