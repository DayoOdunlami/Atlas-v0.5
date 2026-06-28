import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3005";
const AGENT_SKIP =
  process.env.SKIP_V5_E2E === "1" ? "SKIP_V5_E2E=1" : false;

async function agentsHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/atlas/health`, { cache: "no-store" });
    const body = (await res.json()) as { agents?: { ok?: boolean } };
    return body.agents?.ok === true;
  } catch {
    return false;
  }
}

function attachConsoleGuards(page: Page) {
  const depthErrors: string[] = [];
  page.on("pageerror", (err) => {
    if (err.message.includes("Maximum update depth")) {
      depthErrors.push(err.message);
    }
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.includes("Maximum update depth")) {
      depthErrors.push(text);
    }
  });
  return depthErrors;
}

async function waitForTurnIdle(page: Page) {
  const thinking = page.locator('[data-testid="canvas-thinking"]');
  await expect
    .poll(
      async () => {
        const pending = await page
          .locator('[data-testid="atlas-follow-up-input"]')
          .isDisabled()
          .catch(() => false);
        const thinkingVisible = await thinking.isVisible().catch(() => false);
        if (pending || thinkingVisible) return "busy";
        return "idle";
      },
      { timeout: 180_000, intervals: [500, 1000, 2000] },
    )
    .toBe("idle");
}

async function askFollowUp(page: Page, message: string) {
  const input = page.locator('[data-testid="atlas-follow-up-input"]');
  await expect(input).toBeEditable({ timeout: 60_000 });
  await input.fill(message);
  await input.press("Enter");
  await expect(page.getByText(message, { exact: true })).toBeVisible({ timeout: 30_000 });
}

test.describe("Atlas v5 workbench — chat + canvas + dev overlay", () => {
  test.beforeEach(async () => {
    test.skip(!!AGENT_SKIP, AGENT_SKIP as string);
    const ok = await agentsHealthy();
    test.skip(!ok, "Agent service offline — run npm run dev first");
  });

  test("WB-1 entry query → follow-up → canvas or verdict without React depth errors", async ({
    page,
  }) => {
    test.setTimeout(360_000);
    const depthErrors = attachConsoleGuards(page);
    const entryQuery = "State of play on rail decarbonisation in our corpus";
    const followUp = "What about TRIG grants?";

    await page.goto(`${BASE}/atlas?q=${encodeURIComponent(entryQuery)}`);
    await expect(page.locator('[data-testid="atlas-surface-root"]')).toBeVisible({
      timeout: 60_000,
    });
    await waitForTurnIdle(page);

    const hasCanvas =
      (await page.locator('[data-testid="verdict-hero"]').isVisible().catch(() => false)) ||
      (await page.locator('[data-testid="incommensurable-magnitudes"]').isVisible().catch(() => false)) ||
      (await page.locator('[data-testid="atlas-empty-canvas"]').isVisible().catch(() => false));
    expect(hasCanvas).toBe(true);

    await askFollowUp(page, followUp);
    await waitForTurnIdle(page);

    const chat = page.locator('[data-testid="so-what-rail"]');
    await expect(chat).toContainText(followUp);
    expect(depthErrors).toEqual([]);
  });

  test("WB-2 dev overlay toggle does not trigger maximum update depth", async ({ page }) => {
    test.setTimeout(120_000);
    const depthErrors = attachConsoleGuards(page);

    await page.goto(`${BASE}/atlas?q=${encodeURIComponent("Show me what you can do")}`);
    await expect(page.locator('[data-testid="atlas-surface-root"]')).toBeVisible({
      timeout: 60_000,
    });
    await waitForTurnIdle(page);

    const rail = page.getByTestId("atlas-session-rail");
    await rail.hover();
    await page.getByTestId("atlas-dev-overlay-toggle").click();
    await expect(page.getByTestId("atlas-dev-overlay")).toBeVisible();
    await expect(page.getByText("Atlas dev")).toBeVisible();

    await askFollowUp(page, "2");
    await waitForTurnIdle(page);
    expect(depthErrors).toEqual([]);
  });

  test("WB-3 sidebar thread switch keeps URL on selected thread", async ({ page }) => {
    test.setTimeout(120_000);
    const depthErrors = attachConsoleGuards(page);
    await page.setViewportSize({ width: 1440, height: 900 });

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
        sessionStorage.setItem("atlas5-v5-thread-id", threadB);
      },
      { threadA, threadB, now },
    );
    await page.reload();

    await expect(page.locator('[data-testid="atlas-surface-root"]')).toBeVisible({
      timeout: 60_000,
    });

    const rail = page.getByTestId("atlas-session-rail");
    await rail.hover();
    await page.getByTitle("Pin sidebar open").click();

    await page.getByTestId(`atlas-thread-${threadA}`).click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get("thread"), {
        timeout: 10_000,
      })
      .toBe(threadA);

    await page.waitForTimeout(1500);
    expect(new URL(page.url()).searchParams.get("thread")).toBe(threadA);
    expect(depthErrors).toEqual([]);
  });
});
