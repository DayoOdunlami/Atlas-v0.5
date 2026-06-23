/**
 * Shared Playwright helpers — detect orchestrator artifact on canvas or in chat.
 */
import { expect, type Page } from "@playwright/test";

/** Text that appears in live orchestrator UI (headlines, tiers, block titles). */
export const ARTIFACT_SIGNAL =
  /CPC capability|Corpus evidence|Five Case|opportunity routes|Stronger corpus|Speculative|Indicative|Supported|Robust|transfer verdict|Evidence map|Claim inventory|Decision spine|economic case|Defensibility|Sample comparison/i;

export async function askWorkbench(page: Page, text: string) {
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill(text);
  await input.press("Enter");
}

export async function waitForArtifactSignal(page: Page, timeoutMs = 120_000) {
  await expect(page.getByText(ARTIFACT_SIGNAL).first()).toBeVisible({
    timeout: timeoutMs,
  });
}

export async function waitForOrchestratorReady(page: Page) {
  await expect(page.getByText(/orchestrator/i).first()).toBeVisible({
    timeout: 30_000,
  });
}
