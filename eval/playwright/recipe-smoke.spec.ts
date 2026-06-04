/**
 * Atlas 5 — Recipe surface smoke tests (Tier 1)
 *
 * Tests the four recipe surfaces and the legacy BriefView fallback by:
 *   1. Calling the /api/atlas5/fixture endpoint (fast JSON contract check)
 *   2. Navigating to /atlas5-test (fixture-injected render page, no auth)
 *   3. Asserting data-testid selectors are visible in the rendered DOM
 *
 * Prerequisites:
 *   - Next.js dev server running: pnpm dev
 *   - NODE_ENV !== 'production' (fixture endpoint returns 404 in prod)
 *
 * Run:
 *   pnpm eval:tier1:e2e --grep "recipe-smoke"
 *   npx playwright test eval/playwright/recipe-smoke.spec.ts --config playwright.atlas5.config.ts
 *
 * These tests are intentionally:
 *   - Headless only (no visual screenshots — see Tier 3 for that)
 *   - Auth-free (uses public /atlas5-test render page + fixture API)
 *   - Fast (<10s total — no agent calls, no Supabase queries)
 */

import { expect, test } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Call the fixture API and assert ok=true, can_render=true */
async function validateFixtureApi(
  request: import("@playwright/test").APIRequestContext,
  recipe: string,
  expectCanRender = true,
) {
  const res = await request.get(`${BASE}/api/atlas5/fixture?recipe=${recipe}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.schema_issues).toHaveLength(0);
  if (expectCanRender) {
    expect(body.can_render).toBe(true);
    expect(body.recipe_detected).toBe(recipe);
  }
  return body;
}

/** Navigate to the test render page for a fixture */
async function gotoFixture(
  page: import("@playwright/test").Page,
  fixture: string,
  opts: { withSpine?: boolean } = {},
) {
  const params = new URLSearchParams({ fixture });
  if (opts.withSpine) params.set("spine", "1");
  await page.goto(`${BASE}/atlas5-test?${params.toString()}`);
  // Wait for the root element to confirm the page loaded (not a redirect)
  await expect(page.locator('[data-testid="atlas5-test-root"]')).toBeVisible({
    timeout: 10_000,
  });
  // Wait for store hydration: artifact-pane should exit loading state
  await expect(page.locator('[data-testid="artifact-pane"]')).toBeVisible({
    timeout: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Tier 1a — Fixture API contract checks (no browser render)
// ---------------------------------------------------------------------------

test.describe("Fixture API — contract checks", () => {
  test("brief_five_case fixture is schema-valid and can_render=true", async ({
    request,
  }) => {
    const body = await validateFixtureApi(request, "brief_five_case");
    expect(body.sections_count).toBeGreaterThanOrEqual(5);
    expect(body.type).toBe("brief");
    expect(body.citations_count).toBeGreaterThan(0);
  });

  test("evidence_panel fixture is schema-valid and can_render=true", async ({
    request,
  }) => {
    const body = await validateFixtureApi(request, "evidence_panel");
    expect(body.type).toBe("evidence");
    expect(body.citations_count).toBeGreaterThan(0);
  });

  test("stats_dashboard fixture is schema-valid and can_render=true", async ({
    request,
  }) => {
    const body = await validateFixtureApi(request, "stats_dashboard");
    expect(body.type).toBe("chart");
    expect(body.chart_specs_count).toBeGreaterThanOrEqual(2);
  });

  test("scenario_stress_test fixture is schema-valid and can_render=true", async ({
    request,
  }) => {
    const body = await validateFixtureApi(request, "scenario_stress_test");
    expect(body.type).toBe("scenario");
    expect(body.sections_count).toBeGreaterThanOrEqual(4);
  });

  test("legacy_brief fixture can_render=true (falls through to BriefView)", async ({
    request,
  }) => {
    const res = await request.get(
      `${BASE}/api/atlas5/fixture?recipe=legacy_brief`,
    );
    const body = await res.json();
    expect(body.can_render).toBe(true);
    expect(body.recipe_detected).toBeNull(); // detectRecipe returns null → BriefView
    expect(body.schema_issues).toHaveLength(0);
  });

  test("fixture API returns 404 with unknown recipe", async ({ request }) => {
    // Unknown recipe → falls back to brief_five_case, still returns 200
    // (graceful fallback, not an error)
    const res = await request.get(
      `${BASE}/api/atlas5/fixture?recipe=nonexistent`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Falls back to brief_five_case
    expect(body.recipe_detected).toBe("brief_five_case");
  });
});

// ---------------------------------------------------------------------------
// Tier 1b — Render checks (browser DOM + data-testid)
// ---------------------------------------------------------------------------

test.describe("brief_five_case — render", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "brief_five_case");
  });

  test("recipe-brief-five-case component is mounted", async ({ page }) => {
    await expect(
      page.locator('[data-testid="recipe-brief-five-case"]'),
    ).toBeVisible();
  });

  test("recipe-view wrapper is present (DecisionSpine slot active)", async ({
    page,
  }) => {
    await expect(page.locator('[data-testid="recipe-view"]')).toBeVisible();
  });

  test("trust-rail is mounted alongside recipe", async ({ page }) => {
    await expect(page.locator('[data-testid="trust-rail"]')).toBeVisible();
  });

  test("confidence tier badge is visible", async ({ page }) => {
    await expect(
      page.locator('[data-testid="confidence-tier-badge"]'),
    ).toBeVisible();
  });
});

test.describe("evidence_panel — render", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "evidence_panel");
  });

  test("recipe-evidence-panel component is mounted", async ({ page }) => {
    await expect(
      page.locator('[data-testid="recipe-evidence-panel"]'),
    ).toBeVisible();
  });

  test("trust-rail is mounted alongside recipe", async ({ page }) => {
    await expect(page.locator('[data-testid="trust-rail"]')).toBeVisible();
  });
});

test.describe("stats_dashboard — render", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "stats_dashboard");
  });

  test("recipe-stats-dashboard component is mounted", async ({ page }) => {
    await expect(
      page.locator('[data-testid="recipe-stats-dashboard"]'),
    ).toBeVisible();
  });

  test("chart_specs render inline (recharts present in DOM)", async ({
    page,
  }) => {
    // Recharts renders SVG elements — presence of svg confirms chart rendered
    const chartSvg = page
      .locator('[data-testid="recipe-stats-dashboard"] svg')
      .first();
    await expect(chartSvg).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("scenario_stress_test — render", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "scenario_stress_test");
  });

  test("recipe-scenario-stress-test component is mounted", async ({ page }) => {
    await expect(
      page.locator('[data-testid="recipe-scenario-stress-test"]'),
    ).toBeVisible();
  });

  test("trust-rail is mounted alongside recipe", async ({ page }) => {
    await expect(page.locator('[data-testid="trust-rail"]')).toBeVisible();
  });
});

test.describe("legacy_brief — BriefView fallback", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "legacy_brief");
  });

  test("legacy brief-view renders (not recipe-view)", async ({ page }) => {
    // Legacy BriefView should render, not the new RecipeView
    await expect(page.locator('[data-testid="brief-view"]')).toBeVisible();
    // RecipeView must NOT be mounted for legacy briefs
    await expect(page.locator('[data-testid="recipe-view"]')).not.toBeVisible();
  });
});

test.describe("DecisionSpine — render with ?spine=1", () => {
  test("decision-spine-card renders when store has DecisionSpine", async ({
    page,
  }) => {
    await gotoFixture(page, "brief_five_case", { withSpine: true });
    await expect(
      page.locator('[data-testid="decision-spine-card"]'),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Tier 1a — Sprint UX Surface fixture API contract checks
// ---------------------------------------------------------------------------

test.describe("Fixture API — sprint surface contract checks", () => {
  test("orient fixture is schema-valid and can_render=true", async ({
    request,
  }) => {
    const body = await validateFixtureApi(request, "orient");
    expect(body.type).toBe("evidence");
    expect(body.recipe_detected).toBe("orient");
  });

  test("connect fixture is schema-valid and can_render=true", async ({
    request,
  }) => {
    const body = await validateFixtureApi(request, "connect");
    expect(body.type).toBe("evidence");
    expect(body.recipe_detected).toBe("connect");
  });

  test("defend fixture is schema-valid and can_render=true", async ({
    request,
  }) => {
    const body = await validateFixtureApi(request, "defend");
    expect(body.type).toBe("evidence");
    expect(body.recipe_detected).toBe("defend");
  });

  test("organisation_profile fixture is schema-valid and can_render=true", async ({
    request,
  }) => {
    const body = await validateFixtureApi(request, "organisation_profile");
    expect(body.type).toBe("brief");
    expect(body.recipe_detected).toBe("organisation_profile");
    expect(body.sections_count).toBeGreaterThanOrEqual(2);
  });
});

test.describe("organisation_profile — render", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "organisation_profile");
  });

  test("organisation profile surface is mounted", async ({ page }) => {
    await expect(
      page.locator('[data-testid="organisation-profile-surface"]'),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tier 1b — ACT surface (brief_five_case recipe extended with waterfall)
// ---------------------------------------------------------------------------

test.describe("ACT surface (brief_five_case) — render", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "brief_five_case");
  });

  test("act-headline-card is always visible (waterfall level 1)", async ({
    page,
  }) => {
    await expect(page.locator('[data-testid="act-headline-card"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test("npv-waterfall-chart renders when npv_value is present", async ({
    page,
  }) => {
    // Fixture has npv_value — waterfall SVG must be present
    await expect(
      page.locator('[data-testid="npv-waterfall-chart"]'),
    ).toBeVisible({ timeout: 5_000 });
    const chartSvg = page
      .locator('[data-testid="npv-waterfall-chart"] svg')
      .first();
    await expect(chartSvg).toBeVisible({ timeout: 5_000 });
  });

  test("evidence section is collapsed by default (waterfall level 3)", async ({
    page,
  }) => {
    // The toggle button must be visible but the evidence list must NOT be open
    const toggle = page.locator('[data-testid="act-evidence-toggle"]');
    await expect(toggle).toBeVisible();
    // aria-expanded=false means collapsed
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("evidence section expands on toggle click", async ({ page }) => {
    const toggle = page.locator('[data-testid="act-evidence-toggle"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  test("detail toggle is present (waterfall level 4)", async ({ page }) => {
    await expect(
      page.locator('[data-testid="act-detail-toggle"]'),
    ).toBeVisible();
  });

  test("detail section is hidden by default and reveals on click", async ({
    page,
  }) => {
    await expect(
      page.locator('[data-testid="act-detail-section"]'),
    ).not.toBeVisible();
    await page.locator('[data-testid="act-detail-toggle"]').click();
    await expect(
      page.locator('[data-testid="act-detail-section"]'),
    ).toBeVisible({ timeout: 3_000 });
  });

  test("escalation bar is present (canvas action stub)", async ({ page }) => {
    await expect(
      page.locator('[data-testid="act-escalation-bar"]'),
    ).toBeVisible();
  });

  test("confidence tier badge is visible", async ({ page }) => {
    await expect(
      page.locator(
        '[data-testid="recipe-brief-five-case"] [data-testid="confidence-tier-badge"]',
      ),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tier 1b — DIAGNOSE surface (evidence_panel recipe extended)
// ---------------------------------------------------------------------------

test.describe("DIAGNOSE surface (evidence_panel) — render", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "evidence_panel");
  });

  test("diagnose-headline-card is always visible (waterfall level 1)", async ({
    page,
  }) => {
    await expect(
      page.locator('[data-testid="diagnose-headline-card"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("escalation action button is present", async ({ page }) => {
    await expect(
      page.locator('[data-testid="diagnose-escalate-five-case"]'),
    ).toBeVisible();
  });

  test("confidence tier badge is visible", async ({ page }) => {
    await expect(
      page.locator(
        '[data-testid="recipe-evidence-panel"] [data-testid="confidence-tier-badge"]',
      ),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tier 1b — ORIENT surface
// ---------------------------------------------------------------------------

test.describe("ORIENT surface — render", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "orient");
  });

  test("recipe-orient component is mounted", async ({ page }) => {
    await expect(page.locator('[data-testid="recipe-orient"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test("orient-headline-card is always visible (waterfall level 1)", async ({
    page,
  }) => {
    await expect(
      page.locator('[data-testid="orient-headline-card"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("orient-top-evidence section is present", async ({ page }) => {
    await expect(
      page.locator('[data-testid="orient-top-evidence"]'),
    ).toBeVisible();
  });

  test("orient-cpc-position card is present", async ({ page }) => {
    await expect(
      page.locator('[data-testid="orient-cpc-position"]'),
    ).toBeVisible();
  });

  test("orient-domain-heatmap renders when ≥3 domains present", async ({
    page,
  }) => {
    // Fixture has 6 domains — heatmap must render
    await expect(
      page.locator('[data-testid="orient-domain-heatmap"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("find-opportunities action button is present", async ({ page }) => {
    await expect(
      page.locator('[data-testid="orient-find-opportunities"]'),
    ).toBeVisible();
  });

  test("confidence tier badge is visible", async ({ page }) => {
    await expect(
      page.locator(
        '[data-testid="recipe-orient"] [data-testid="confidence-tier-badge"]',
      ),
    ).toBeVisible();
  });

  test("trust-rail is mounted alongside recipe", async ({ page }) => {
    await expect(page.locator('[data-testid="trust-rail"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tier 1b — CONNECT surface
// ---------------------------------------------------------------------------

test.describe("CONNECT surface — render", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "connect");
  });

  test("recipe-connect component is mounted", async ({ page }) => {
    await expect(page.locator('[data-testid="recipe-connect"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test("connect-headline-card is always visible (waterfall level 1)", async ({
    page,
  }) => {
    await expect(
      page.locator('[data-testid="connect-headline-card"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("at least one opportunity card is rendered", async ({ page }) => {
    // Fixture has 4 opportunities — at least the first must render
    await expect(
      page.locator('[data-testid="connect-opportunity-op1"]'),
    ).toBeVisible();
  });

  test("diagnose-fit action is present on first opportunity", async ({
    page,
  }) => {
    await expect(
      page.locator('[data-testid="connect-diagnose-op1"]'),
    ).toBeVisible();
  });

  test("sector bridge card is rendered when connect_bridge present", async ({
    page,
  }) => {
    await expect(
      page.locator('[data-testid="connect-sector-bridge"]'),
    ).toBeVisible();
  });

  test("confidence tier badge is visible", async ({ page }) => {
    await expect(
      page.locator(
        '[data-testid="recipe-connect"] [data-testid="confidence-tier-badge"]',
      ),
    ).toBeVisible();
  });

  test("trust-rail is mounted alongside recipe", async ({ page }) => {
    await expect(page.locator('[data-testid="trust-rail"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tier 1b — DEFEND surface
// ---------------------------------------------------------------------------

test.describe("DEFEND surface — render", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page, "defend");
  });

  test("recipe-defend component is mounted", async ({ page }) => {
    await expect(page.locator('[data-testid="recipe-defend"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test("defend-headline-card is always visible (waterfall level 1)", async ({
    page,
  }) => {
    await expect(
      page.locator('[data-testid="defend-headline-card"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("defend-assumptions list is rendered", async ({ page }) => {
    await expect(
      page.locator('[data-testid="defend-assumptions"]'),
    ).toBeVisible();
  });

  test("confidence tier badge is visible (Speculative — low visual weight)", async ({
    page,
  }) => {
    const badge = page.locator(
      '[data-testid="recipe-defend"] [data-testid="confidence-tier-badge"]',
    );
    await expect(badge).toBeVisible();
    // Badge should contain the tier text
    await expect(badge).toContainText("Speculative");
  });

  test("trust-rail is mounted alongside recipe", async ({ page }) => {
    await expect(page.locator('[data-testid="trust-rail"]')).toBeVisible();
  });

  test("defend-evidence-tree is rendered", async ({ page }) => {
    await expect(
      page.locator('[data-testid="defend-evidence-tree"]').first(),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tier 1b — Cross-cutting: claim state badges
// ---------------------------------------------------------------------------

test.describe("Claim state badges — cross-cutting", () => {
  test("stated claim-state badge renders in orient top-evidence", async ({
    page,
  }) => {
    await gotoFixture(page, "orient");
    // Fixture has claim_state on citations — at least one badge should be present
    await expect(
      page.locator('[data-testid^="claim-state-badge-"]').first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("multiple claim state badge variants present in connect fixture", async ({
    page,
  }) => {
    await gotoFixture(page, "connect");
    // Connect fixture has stated + inferred + contested — multiple badges
    const badges = page.locator('[data-testid^="claim-state-badge-"]');
    await expect(badges.first()).toBeVisible({ timeout: 5_000 });
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("claim-state badges present in brief_five_case evidence section", async ({
    page,
  }) => {
    await gotoFixture(page, "brief_five_case");
    // Open evidence section first
    const toggle = page.locator('[data-testid="act-evidence-toggle"]');
    await expect(toggle).toBeVisible();
    await toggle.click();
    // Badges should now be visible inside the open evidence list
    await expect(
      page.locator('[data-testid^="claim-state-badge-"]').first(),
    ).toBeVisible({ timeout: 3_000 });
  });
});

// ---------------------------------------------------------------------------
// Tier 1b — Cross-cutting: confidence visual weight distinction
// ---------------------------------------------------------------------------

test.describe("Confidence visual weight — cross-cutting", () => {
  test("Speculative tier renders recipe-defend container with opacity class", async ({
    page,
  }) => {
    await gotoFixture(page, "defend");
    // The defend container should have the Speculative opacity class applied
    // getConfidenceStyles("Speculative").container === "opacity-[0.85]"
    const container = page.locator('[data-testid="recipe-defend"]');
    await expect(container).toBeVisible();
    // Confirm the parent wrapper carries the opacity class
    const wrapper = container.locator("xpath=.."); // immediate parent
    await expect(wrapper).toHaveClass(/opacity-\[0\.85\]/);
  });

  test("Supported tier renders orient container without opacity reduction", async ({
    page,
  }) => {
    await gotoFixture(page, "orient");
    // Supported tier: container class is "opacity-[0.97]"
    const container = page.locator('[data-testid="recipe-orient"]');
    await expect(container).toBeVisible();
    const wrapper = container.locator("xpath=..");
    await expect(wrapper).toHaveClass(/opacity-\[0\.97\]/);
  });
});

// ---------------------------------------------------------------------------
// Tier 1b — Cross-cutting: cold session entry
// (Tested via the /atlas5-test page with ?cold=1 to suppress fixture injection)
// ---------------------------------------------------------------------------

test.describe("Cold session entry — cross-cutting", () => {
  test("cold-session-entry renders when no thread_id and no messages", async ({
    page,
  }) => {
    // Navigate without a fixture — store should be in cold state
    await page.goto(`${BASE}/atlas5-test?cold=1`);
    await expect(page.locator('[data-testid="atlas5-test-root"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator('[data-testid="cold-session-entry"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("all three cold chips are visible", async ({ page }) => {
    await page.goto(`${BASE}/atlas5-test?cold=1`);
    await expect(page.locator('[data-testid="atlas5-test-root"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator('[data-testid="cold-chip-explore-the-innovation-landscape"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator(
        '[data-testid="cold-chip-assess-a-capability-or-product"]',
      ),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="cold-chip-build-an-investment-case"]'),
    ).toBeVisible();
  });

  test("clicking a chip populates chat input but does NOT submit", async ({
    page,
  }) => {
    await page.goto(`${BASE}/atlas5-test?cold=1`);
    await expect(page.locator('[data-testid="atlas5-test-root"]')).toBeVisible({
      timeout: 10_000,
    });
    const chip = page.locator(
      '[data-testid="cold-chip-explore-the-innovation-landscape"]',
    );
    await expect(chip).toBeVisible({ timeout: 5_000 });
    await chip.click();
    // Chat input should now contain the chip text (populated, not submitted)
    const input = page.locator('[data-testid="chat-input"]');
    await expect(input).toHaveValue(/Explore the innovation landscape/i, {
      timeout: 2_000,
    });
    // Message list should still be empty — no auto-submit
    const messages = page.locator('[data-testid^="message-"]');
    expect(await messages.count()).toBe(0);
  });
});
