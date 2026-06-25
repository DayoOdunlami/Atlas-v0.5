import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3005";
const AGENT_SKIP =
  process.env.SKIP_V5_E2E === "1"
    ? "SKIP_V5_E2E=1"
    : false;

async function agentsHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/atlas/health`, { cache: "no-store" });
    const body = (await res.json()) as { agents?: { ok?: boolean } };
    return body.agents?.ok === true;
  } catch {
    return false;
  }
}

async function waitForSessionReady(page: Page) {
  await expect(page.locator('[data-testid="atlas-surface-root"]')).toBeVisible({
    timeout: 60_000,
  });
  // Bootstrap turn: thinking finishes or canvas gets content
  const thinking = page.locator('[data-testid="canvas-thinking"]');
  const verdict = page.locator('[data-testid="verdict-hero"]');
  const empty = page.locator('[data-testid="atlas-empty-canvas"]');
  await expect
    .poll(
      async () => {
        if (await verdict.isVisible().catch(() => false)) return "verdict";
        if (await empty.isVisible().catch(() => false)) return "empty";
        if (!(await thinking.isVisible().catch(() => false))) return "idle";
        return "thinking";
      },
      { timeout: 180_000, intervals: [500, 1000, 2000] },
    )
    .not.toBe("thinking");
}

async function askFollowUp(page: Page, message: string) {
  const input = page.locator('[data-testid="atlas-follow-up-input"]');
  await expect(input).toBeEditable({ timeout: 30_000 });
  await input.fill(message);
  await input.press("Enter");
  await expect(page.getByText(message, { exact: true })).toBeVisible({ timeout: 15_000 });
}

test.describe("Atlas v5 session E2E", () => {
  test.beforeEach(async () => {
    test.skip(!!AGENT_SKIP, AGENT_SKIP as string);
    const ok = await agentsHealthy();
    test.skip(!ok, "Agent service offline — run npm run dev first");
  });

  test("E2E-1 entry screen → session → follow-up", async ({ page }) => {
    test.setTimeout(360_000);
    const entryQuery = "State of play on rail decarbonisation in our corpus";
    const followUp = "What about TRIG grants?";

    await page.goto(`${BASE}/atlas`);
    await expect(page.locator('[data-testid="so-what-rail"]')).toBeVisible();

    const input = page.locator('[data-testid="atlas-follow-up-input"]');
    await input.fill(entryQuery);
    await input.press("Enter");

    await page.waitForURL(/\/atlas\/session/, { timeout: 30_000 });
    await waitForSessionReady(page);

    await askFollowUp(page, followUp);

    await expect
      .poll(
        async () => {
          const text = await page.locator('[data-testid="so-what-rail"]').innerText();
          const lower = text.toLowerCase();
          if (lower.includes("lost the thread")) return "lost";
          if (lower.includes("paste your question")) return "paste";
          const assistantLines = text.split("\n").length;
          return assistantLines > 4 ? "multi" : "waiting";
        },
        { timeout: 180_000 },
      )
      .toBe("multi");
  });

  test("E2E-2 session URL bootstrap + follow-up", async ({ page }) => {
    test.setTimeout(360_000);
    const entryQuery = encodeURIComponent(
      "State of play on rail decarbonisation in our corpus",
    );
    const followUp = "Which funders dominate?";

    await page.goto(`${BASE}/atlas/session?q=${entryQuery}`);
    await waitForSessionReady(page);

    await askFollowUp(page, followUp);

    await expect(page.locator('[data-testid="atlas-connection-status"]')).toBeVisible();
    await expect(page.getByText(followUp, { exact: true })).toBeVisible();
  });

  test("E2E-3 connection pill lists corpus tiers", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`${BASE}/atlas`);
    const pill = page.locator('[data-testid="atlas-connection-status"] button');
    await expect(pill).toBeVisible();
    await pill.click();
    await expect(page.getByText("Postgres pooler")).toBeVisible();
    await expect(page.getByText("Supabase REST")).toBeVisible();
  });
});
