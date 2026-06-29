/**
 * Atlas v5 MOT — infrastructure E2E (headless, no manual browser needed).
 * Covers UX bugs API trajectories cannot see: entry bootstrap, thread switch, sidebar.
 */
import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3005";
const AGENT_SKIP = process.env.SKIP_V5_E2E === "1" ? "SKIP_V5_E2E=1" : false;

async function agentsHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/atlas/health`, { cache: "no-store" });
    const body = (await res.json()) as { agents?: { ok?: boolean } };
    return body.agents?.ok === true;
  } catch {
    return false;
  }
}

async function openSessionRail(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  const rail = page.getByTestId("atlas-session-rail");
  await rail.hover();
  await page.getByTitle("Pin sidebar open").click();
}

test.describe("Atlas v5 MOT — infrastructure", () => {
  test.beforeEach(async () => {
    test.skip(!!AGENT_SKIP, AGENT_SKIP as string);
    const ok = await agentsHealthy();
    test.skip(!ok, "Agent service offline — run npm run dev first");
  });

  test("MOT-1 entry question auto-sends without retype", async ({ page }) => {
    test.setTimeout(360_000);
    const entryQuery = "What is the state of play on hydrogen in our corpus?";

    await page.goto(`${BASE}/atlas`);
    await expect(page.locator('[data-testid="so-what-rail"]')).toBeVisible();

    const input = page.locator('[data-testid="atlas-follow-up-input"]');
    await input.fill(entryQuery);
    await input.press("Enter");

    await page.waitForURL(/\/atlas\?.*thread=/, { timeout: 30_000 });
    await expect(page.locator('[data-testid="atlas-surface-root"]')).toBeVisible({
      timeout: 60_000,
    });

    await expect(page.getByText(entryQuery, { exact: true })).toBeVisible({ timeout: 30_000 });

    const followUp = page.locator('[data-testid="atlas-follow-up-input"]');
    await expect
      .poll(
        async () => {
          const userVisible = await page.getByText(entryQuery, { exact: true }).isVisible();
          const thinking = await page
            .locator('[data-testid="canvas-thinking"]')
            .isVisible()
            .catch(() => false);
          const assistantLines = await page.locator('[data-testid="so-what-rail"]').innerText();
          const hasAssistant =
            assistantLines.split("\n").filter((l) => l.trim().length > 20).length > 2;
          if (userVisible && (thinking || hasAssistant)) return "sent";
          return "waiting";
        },
        { timeout: 180_000, intervals: [1000, 2000, 3000] },
      )
      .toBe("sent");

    await expect(followUp).toBeEditable({ timeout: 60_000 });
  });

  test("MOT-2 thread switch persists URL and shows thread in sidebar", async ({ page }) => {
    test.setTimeout(120_000);
    const threadA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const threadB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const now = new Date().toISOString();

    await page.goto(`${BASE}/atlas?thread=${threadB}`);
    await page.evaluate(
      ({ threadA, threadB, now }) => {
        sessionStorage.setItem(
          "atlas5:thread-list",
          JSON.stringify([
            {
              id: threadA,
              title: "Session A",
              lens: "CPC",
              created_at: now,
              updated_at: now,
            },
            {
              id: threadB,
              title: "Session B",
              lens: "CPC",
              created_at: now,
              updated_at: now,
            },
          ]),
        );
      },
      { threadA, threadB, now },
    );
    await page.reload();
    await expect(page.locator('[data-testid="atlas-surface-root"]')).toBeVisible({
      timeout: 60_000,
    });

    await openSessionRail(page);
    await page.getByTestId(`atlas-thread-${threadA}`).click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get("thread"), { timeout: 10_000 })
      .toBe(threadA);

    await page.waitForTimeout(1200);
    expect(new URL(page.url()).searchParams.get("thread")).toBe(threadA);
  });

  test("MOT-3 threads API configured on preview/local", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`${BASE}/atlas?thread=00000000-0000-4000-8000-000000000001`);
    const res = await page.request.get(`${BASE}/api/atlas/threads`);
    expect(res.status()).toBeLessThan(500);
    const body = (await res.json()) as { configured?: boolean; authorized?: boolean };
    expect(body.configured).toBe(true);
  });
});
