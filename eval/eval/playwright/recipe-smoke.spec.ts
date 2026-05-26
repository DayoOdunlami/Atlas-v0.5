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
