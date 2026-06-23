/**
 * D5.6 — MVP gate: five demo scenarios on live /workbench (HTTP + CopilotKit path).
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

test.describe("MVP gate — five scenarios (S1–S5)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!!skip, skip as string);
    await page.goto("/workbench");
    await page.waitForLoadState("domcontentloaded");
    await waitForOrchestratorReady(page);
  });

  test("S1 sector deep-dive — rail", async ({ page }) => {
    test.setTimeout(180_000);
    await askWorkbench(page, "What is CPC good at in rail?");
    await waitForArtifactSignal(page);
  });

  test("S2 flagship journey — opportunities", async ({ page }) => {
    test.setTimeout(240_000);
    await askWorkbench(page, "What is CPC good at in rail?");
    await waitForArtifactSignal(page);
    await askWorkbench(page, "What are the top opportunity routes for CPC in rail?");
    await waitForArtifactSignal(page);
    await expect(page.getByText(/opportunity routes/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test("S3 canonical value translation", async ({ page }) => {
    test.setTimeout(180_000);
    await askWorkbench(
      page,
      "What evidence does CPC have in smart mobility that would transfer to the Innovate UK Smart City Challenge?",
    );
    await expect(page.getByText(/Transfer|MatchBench|transfer/i).first()).toBeVisible({
      timeout: 120_000,
    });
  });

  test("S4 act — next move", async ({ page }) => {
    test.setTimeout(180_000);
    await askWorkbench(page, "What should CPC do next to pursue rail innovation funding?");
    await waitForArtifactSignal(page);
  });

  test("S5 defend — push back", async ({ page }) => {
    test.setTimeout(180_000);
    await askWorkbench(
      page,
      "We're considering a major rail bid — back it up or push back with evidence",
    );
    await waitForArtifactSignal(page);
  });

  test("health page shows orchestrator status", async ({ page }) => {
    await page.goto("/workbench/health");
    await expect(page.getByText(/Workbench health/i)).toBeVisible();
    await expect(page.getByText(/Agents service|Orchestrator flag/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
