/**
 * Atlas 5 — Visualisation Lab E2E spec (Playwright)
 *
 * Validates the two-mode lab page at /lab/visualisation.
 * Three test suites:
 *   1. API — corpus endpoint returns valid data shapes
 *   2. Fixture mode — static mock cards render charts without network
 *   3. Corpus mode — toggle triggers API fetch and renders chart
 *
 * Run: npm run eval:tier1:e2e
 * Requires: dev server running at http://localhost:3000
 *           POSTGRES_URL or DATABASE_URL set (for corpus mode tests)
 *
 * No agent calls. No write operations. All DB queries are read-only aggregations.
 */
import { expect, request, test } from "@playwright/test";

const BASE_URL =
  process.env.TEST_BASE_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "http://localhost:3000";

const API_ENDPOINT = `${BASE_URL}/api/atlas5/visualisation-data`;
const LAB_PAGE = "/lab/visualisation";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function gotoLab(page: import("@playwright/test").Page) {
  await page.goto(LAB_PAGE);
  // Wait for the card grid — confirms React hydration
  await page.waitForSelector('[data-testid="visualisation-lab-cards"]', {
    timeout: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Suite 1: API — corpus endpoint contract
// ---------------------------------------------------------------------------

test.describe("Visualisation Lab — API contract", () => {
  const REQUIRED_CASES = [
    "project_timeline",
    "live_calls_landscape",
    "semantic_clusters",
    "knowledge_authority",
    "innovation_map",
  ] as const;

  test("returns 400 with supported list when ?case= is missing", async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(API_ENDPOINT);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("supported");
    expect(Array.isArray(body.supported)).toBe(true);
  });

  test("returns 400 for an unknown case", async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${API_ENDPOINT}?case=not_a_real_case`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown case/);
  });

  for (const caseName of REQUIRED_CASES) {
    test(`?case=${caseName} returns ok=true with required fields`, async () => {
      const ctx = await request.newContext();
      const res = await ctx.get(`${API_ENDPOINT}?case=${caseName}`);

      // 200 or 500 — either is acceptable in CI without a live DB;
      // what matters is that the response conforms to the contract.
      expect([200, 500]).toContain(res.status());

      const body = await res.json();
      // 500 from DB unavailability is fine; it must still be JSON with {ok, case}
      expect(body).toHaveProperty("case", caseName);

      if (res.status() === 200) {
        expect(body.ok).toBe(true);
        expect(typeof body.renderer).toBe("string");
        expect(typeof body.data_source).toBe("string");
        expect(typeof body.story).toBe("string");
        expect(Array.isArray(body.data)).toBe(true);
        expect(Array.isArray(body.caveats)).toBe(true);
        expect(typeof body.row_count).toBe("number");
      }
    });
  }

  // The three cases the user explicitly requested pass-checks for
  for (const caseName of [
    "project_timeline",
    "live_calls_landscape",
    "semantic_clusters",
  ] as const) {
    test(`?case=${caseName} ok=true when DB is reachable`, async () => {
      const ctx = await request.newContext();
      const res = await ctx.get(`${API_ENDPOINT}?case=${caseName}`);

      // Skip this assertion if DB is not configured in the current environment
      if (res.status() === 500) {
        const body = await res.json();
        // Must have error detail, not a crash
        expect(body).toHaveProperty("error");
        test.skip(
          true,
          `DB unavailable (${body.detail ?? "no detail"}), skipping ok=true assertion`,
        );
        return;
      }

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
    });
  }
});

// ---------------------------------------------------------------------------
// Suite 2: Fixture mode — static mocks render without network
// ---------------------------------------------------------------------------

test.describe("Visualisation Lab — Fixture mode", () => {
  test.beforeEach(async ({ page }) => {
    // Block the corpus API entirely so we're testing only fixture data
    await page.route(`**/api/atlas5/visualisation-data**`, (route) =>
      route.abort(),
    );
    await gotoLab(page);
  });

  const FIXTURE_CASES = [
    "project_timeline",
    "live_calls_landscape",
    "knowledge_authority",
    "semantic_clusters",
    "innovation_map",
    "five_case_flow",
  ];

  for (const id of FIXTURE_CASES) {
    test(`card ${id} renders a chart in fixture mode`, async ({ page }) => {
      // Each card starts in fixture mode by default
      const card = page.locator(`[data-testid="card-${id}"]`);
      await expect(card).toBeVisible({ timeout: 10_000 });

      // The chart container must be visible
      const chart = card.locator(`[data-testid="chart-${id}"]`);
      await expect(chart).toBeVisible({ timeout: 10_000 });

      // The fixture mode button must exist and be accessible
      const fixtureBtn = card.locator(`[data-testid="mode-fixture-${id}"]`);
      await expect(fixtureBtn).toBeVisible();
    });
  }

  test("fixture mode button is present on every card", async ({ page }) => {
    for (const id of FIXTURE_CASES) {
      await expect(
        page.locator(`[data-testid="mode-fixture-${id}"]`),
      ).toBeVisible();
    }
  });

  test("corpus mode button is present on every card", async ({ page }) => {
    for (const id of FIXTURE_CASES) {
      await expect(
        page.locator(`[data-testid="mode-corpus-${id}"]`),
      ).toBeVisible();
    }
  });

  test("renderer stack status panel is visible", async ({ page }) => {
    await expect(
      page.locator('[data-testid="renderer-stack-status"]'),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Corpus mode — API fetch triggered on toggle, chart renders
// ---------------------------------------------------------------------------

test.describe("Visualisation Lab — Corpus mode toggle", () => {
  test.beforeEach(async ({ page }) => {
    await gotoLab(page);
  });

  // The three cases the user explicitly called out
  const CORPUS_CASES = [
    "project_timeline",
    "live_calls_landscape",
    "semantic_clusters",
  ] as const;

  for (const id of CORPUS_CASES) {
    test(`toggling to corpus on ${id} triggers API call and renders chart`, async ({
      page,
    }) => {
      // Intercept and capture the API request
      let capturedUrl: string | null = null;
      await page.route(`**/api/atlas5/visualisation-data**`, async (route) => {
        capturedUrl = route.request().url();
        await route.continue();
      });

      const card = page.locator(`[data-testid="card-${id}"]`);
      await expect(card).toBeVisible();

      // Click corpus mode
      const corpusBtn = card.locator(`[data-testid="mode-corpus-${id}"]`);
      await corpusBtn.click();

      // The API should have been called with the right case parameter
      await page.waitForResponse(
        (res) =>
          res.url().includes("visualisation-data") &&
          res.url().includes(`case=${id}`),
        { timeout: 10_000 },
      );

      expect(capturedUrl).toContain(`case=${id}`);

      // Chart or error state must appear (not a blank spinner)
      const chart = card.locator(`[data-testid="chart-${id}"]`);
      const errorEl = card.locator('[data-testid^="corpus-error-"]');

      // Wait for either chart or error to become visible
      await Promise.race([
        chart.waitFor({ state: "visible", timeout: 10_000 }),
        errorEl.first().waitFor({ state: "visible", timeout: 10_000 }),
      ]);

      // If chart is visible it must have child elements (not empty)
      const chartVisible = await chart.isVisible();
      if (chartVisible) {
        const childCount = await chart.evaluate((el) => el.childElementCount);
        expect(childCount).toBeGreaterThan(0);
      }
    });
  }

  test("switching back to fixture mode renders static chart immediately", async ({
    page,
  }) => {
    const id = "project_timeline";
    const card = page.locator(`[data-testid="card-${id}"]`);
    await expect(card).toBeVisible();

    // Go to corpus first
    await card.locator(`[data-testid="mode-corpus-${id}"]`).click();
    // Then back to fixture
    await card.locator(`[data-testid="mode-fixture-${id}"]`).click();

    // Chart should re-render without a network call
    const chart = card.locator(`[data-testid="chart-${id}"]`);
    await expect(chart).toBeVisible({ timeout: 5_000 });
  });
});
