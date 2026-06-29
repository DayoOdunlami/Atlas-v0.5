/**
 * Atlas v5 case file — SME claims lifecycle smoke (Phase 3).
 */
import { expect, test } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3005";

async function agentsHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/atlas/health`, { cache: "no-store" });
    const body = (await res.json()) as { agents?: { ok?: boolean } };
    return body.agents?.ok === true;
  } catch {
    return false;
  }
}

test.describe("Atlas v5 case file SME smoke", () => {
  test.beforeEach(async () => {
    const ok = await agentsHealthy();
    test.skip(!ok, "Agent service offline — run npm run dev first");
  });

  test("case file panel mounts in session workspace", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto(`${BASE}/atlas?thread=00000000-0000-4000-8000-casefile01`);
    await expect(page.locator('[data-testid="atlas-surface-root"]')).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.locator('[data-testid="case-file-panel"]')).toBeVisible({
      timeout: 15_000,
    });
  });
});
