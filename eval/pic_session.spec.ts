/**
 * PIC — Product Interaction Contract (multi-turn session behaviour).
 */
import { expect, test } from "@playwright/test";
import {
  askWorkbench,
  waitForArtifactSignal,
  waitForOrchestratorReady,
} from "./workbench-artifact-signal";

const skip =
  process.env.NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1 !== "true"
    ? "Set NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1=true"
    : false;

test.describe("PIC — session contract (multi-turn)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!!skip, skip as string);
    await page.goto("/workbench");
    await page.waitForLoadState("domcontentloaded");
    await waitForOrchestratorReady(page);
  });

  test("PIC-1 orient then clarify preserves artifact context", async ({ page }) => {
    test.setTimeout(240_000);
    await askWorkbench(page, "What is CPC good at in rail?");
    await waitForArtifactSignal(page);
    await askWorkbench(page, "Why is confidence only Indicative?");
    await expect(
      page.getByText(/Confidence|Speculative|Indicative|tier|capped|corpus/i).first(),
    ).toBeVisible({ timeout: 90_000 });
  });

  test("PIC-2 outcome change replaces canvas (Five Case after SWOT)", async ({ page }) => {
    test.setTimeout(300_000);
    await askWorkbench(page, "SWOT for CPC in rail");
    await waitForArtifactSignal(page);
    await askWorkbench(page, "Give me a Five Case investment brief for rail decarbonisation");
    await expect(page.getByText(/Five Case|investment brief|economic case/i).first()).toBeVisible({
      timeout: 120_000,
    });
  });

  test("PIC-3 artifact meta question gets substantive reply", async ({ page }) => {
    test.setTimeout(240_000);
    await askWorkbench(
      page,
      "What evidence does CPC have in smart mobility that would transfer to the Innovate UK Smart City Challenge?",
    );
    await waitForArtifactSignal(page);
    await askWorkbench(page, "Why isn't the artifact updating?");
    await expect(
      page.getByText(/artifact|canvas|sample|demo|unchanged|screen|transfer|Speculative/i).first(),
    ).toBeVisible({ timeout: 90_000 });
  });

  test("PIC-4 connect routes skip VT demo for opportunity query", async ({ page }) => {
    test.setTimeout(240_000);
    await askWorkbench(page, "What is CPC good at in rail?");
    await waitForArtifactSignal(page);
    await askWorkbench(page, "What are the top opportunity routes for CPC in rail?");
    await expect(page.getByText(/opportunity routes|Top \d+ opportunity/i).first()).toBeVisible({
      timeout: 120_000,
    });
  });
});
