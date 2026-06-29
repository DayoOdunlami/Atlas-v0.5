/**
 * Atlas v5 demo — 3 rehydrated multi-turn sessions + sidebar thread switching.
 * No live CopilotKit required; shows saved chat history + canvas from Postgres.
 */
import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3005";

/** Threads verified to have 2+ turns with answer_spec in DB */
const SESSIONS = [
  { id: "4cbf85c7-ddc1-4d43-9cea-23f888f56573", title: "State of play on rail decarbonisation" },
  { id: "00186f58-d39f-43af-af1d-ff6500ba1562", title: "Justify your existence" },
  { id: "ecde944f-9fd0-4294-863c-e0de4dd4b208", title: "Where is our funding thinnest" },
];

async function pinSidebar(page: Page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.getByTestId("atlas-session-rail").hover();
  const pin = page.getByTitle("Pin sidebar open");
  if (await pin.isVisible().catch(() => false)) await pin.click();
}

async function waitForSession(page: Page) {
  await expect(page.locator('[data-testid="atlas-surface-root"]')).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(
      async () => {
        const rail = await page.locator('[data-testid="so-what-rail"]').innerText();
        const lines = rail.split("\n").filter((l) => l.trim().length > 30);
        const verdict = await page.locator('[data-testid="verdict-hero"]').isVisible().catch(() => false);
        return lines.length >= 2 || verdict ? "ok" : "wait";
      },
      { timeout: 90_000, intervals: [1000, 2000, 3000] },
    )
    .toBe("ok");
  await page.waitForTimeout(2000);
}

test("Atlas v5 — 3 multi-turn sessions + thread switch", async ({ page }) => {
  test.setTimeout(300_000);

  for (const s of SESSIONS) {
    await page.goto(`${BASE}/atlas?thread=${s.id}`);
    await waitForSession(page);
  }

  await pinSidebar(page);
  for (const s of SESSIONS) {
    await page.goto(`${BASE}/atlas?thread=${s.id}`);
    await waitForSession(page);
    await page.locator('[data-testid="so-what-rail"]').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(2000);
  }
});
