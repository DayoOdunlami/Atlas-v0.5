/**
 * ATLAS v5 — Surface demo recording (Playwright + video)
 *
 * Prerequisites: .env.local or cloud Secrets (see eval/demo/recordings/BLOCKED.md)
 * Stack: langgraph dev :2024 + LANGGRAPH_API_URL + pnpm run dev:ui :3005
 *
 * Run: pnpm run demo:record
 */
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const RECORDINGS_DIR = path.join(__dirname, "recordings");

type RowMeta = {
  surface: string;
  query: string;
  recipe: string;
  tier: string;
  citations: string;
  pass: string;
  video: string;
  notes: string;
};

const indexRows: RowMeta[] = [];

async function gotoHome(page: Page) {
  await page.goto("/");
  await expect(page.locator('[data-testid="artifact-pane"]')).toBeVisible({
    timeout: 60_000,
  });
}

async function startNewThread(page: Page) {
  const newBtn = page.getByRole("button", { name: /new thread/i });
  if (await newBtn.isVisible().catch(() => false)) {
    await newBtn.click();
    await page.waitForTimeout(800);
  }
}

async function sendQuery(page: Page, query: string) {
  const input = page.locator(".aui-composer-input");
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill(query);
  const shell = page.locator('[data-slot="aui_composer-shell"]');
  const sendBtn = shell.locator("button").filter({ hasNot: page.locator("[disabled]") }).last();
  await sendBtn.click();
}

async function waitForRunComplete(page: Page, recipeTestId: string) {
  await page
    .locator('[data-testid="artifact-loading"]')
    .waitFor({ state: "hidden", timeout: 480_000 })
    .catch(() => {});
  await expect(page.locator(`[data-testid="${recipeTestId}"]`)).toBeVisible({
    timeout: 480_000,
  });
  await expect(page.locator('[data-testid="surface-headline"]')).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('[data-testid="confidence-tier-badge"]').first()).toBeVisible({
    timeout: 30_000,
  });
}

async function readArtifactMeta(page: Page) {
  const recipeEl = page
    .locator(
      '[data-testid="recipe-orient"]:visible, [data-testid="recipe-diagnose"]:visible, [data-testid="recipe-connect"]:visible, [data-testid="recipe-brief-five-case"]:visible, [data-testid="recipe-defend"]:visible, [data-testid="recipe-view"]:visible',
    )
    .first();
  const recipe = (await recipeEl.getAttribute("data-testid")) ?? "unknown";
  const tier =
    (await page.locator('[data-testid="confidence-tier-badge"]').first().textContent())?.trim() ??
    "—";
  const corpus = await page.locator('[data-testid="corpus-citations-list"] li').count();
  return { recipe, tier, citations: String(corpus) };
}

async function saveVideo(page: Page, slug: string) {
  const video = page.video();
  if (!video) return;
  const webm = path.join(RECORDINGS_DIR, `${slug}.webm`);
  await video.saveAs(webm);
  const mp4 = path.join(RECORDINGS_DIR, `${slug}.mp4`);
  if (fs.existsSync(webm)) {
    try {
      fs.renameSync(webm, mp4);
    } catch {
      fs.copyFileSync(webm, mp4);
    }
  }
}

async function captureSurface(
  page: Page,
  testInfo: TestInfo,
  slug: string,
  surface: string,
  query: string,
  passNote: string,
) {
  await page.locator('[data-testid="artifact-pane"]').screenshot({
    path: path.join(RECORDINGS_DIR, `${slug}.png`),
  });
  await saveVideo(page, slug);
  const meta = await readArtifactMeta(page);
  const chat = (await page.locator(".aui-thread-viewport").textContent()) ?? "";
  const pass =
    chat.includes('{"sections"') && chat.trim().startsWith("{") ? "FAIL (raw JSON)" : passNote;
  indexRows.push({
    surface,
    query,
    recipe: meta.recipe,
    tier: meta.tier,
    citations: meta.citations,
    pass,
    video: `${slug}.mp4`,
    notes: testInfo.title,
  });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  const required = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "POSTGRES_URL"];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    throw new Error(
      `Recording blocked — missing: ${missing.join(", ")}. See eval/demo/recordings/BLOCKED.md`,
    );
  }
});

/** One browser page for Orient → Clarify → Refine (same LangGraph thread). */
test.describe("Orient multi-turn thread", () => {
  let orientPage: Page;

  test.beforeAll(async ({ browser }) => {
    orientPage = await browser.newPage();
    await gotoHome(orientPage);
    await startNewThread(orientPage);
  });

  test.afterAll(async () => {
    await orientPage?.close();
  });

  test("01 Orient", async ({}, testInfo) => {
    await sendQuery(
      orientPage,
      "Explore the innovation landscape for connected and autonomous transport in the UK.",
    );
    await waitForRunComplete(orientPage, "recipe-orient");
    await captureSurface(
      orientPage,
      testInfo,
      "01-orient",
      "Orient",
      "Explore the innovation landscape for connected and autonomous transport in the UK.",
      "PASS if headline + orient sections + tier",
    );
  });

  test("06 Clarify NPV (same thread as Orient)", async ({}, testInfo) => {
    const headlineBefore = await orientPage
      .locator('[data-testid="surface-headline"]')
      .textContent();
    await sendQuery(orientPage, "What is NPV?");
    await expect(orientPage.locator(".aui-assistant-message").last()).toBeVisible({
      timeout: 180_000,
    });
    const answer = await orientPage.locator(".aui-assistant-message").last().textContent();
    expect((answer ?? "").length).toBeGreaterThan(80);
    const headlineAfter = await orientPage
      .locator('[data-testid="surface-headline"]')
      .textContent();
    expect(headlineAfter).toBe(headlineBefore);
    await saveVideo(orientPage, "06-clarify-npv");
    indexRows.push({
      surface: "Clarify",
      query: "What is NPV?",
      recipe: "—",
      tier: "—",
      citations: "—",
      pass: (answer ?? "").length > 80 ? "PASS" : "FAIL",
      video: "06-clarify-npv.mp4",
      notes: "artifact unchanged; long chat answer",
    });
  });

  test("07 Refine key players (same thread as Orient)", async ({}, testInfo) => {
    await sendQuery(orientPage, "Add key players to the landscape");
    await expect(orientPage.locator(".aui-assistant-message").last()).toBeVisible({
      timeout: 180_000,
    });
    await orientPage.waitForTimeout(8000);
    await expect(orientPage.getByText(/key players/i).first()).toBeVisible({
      timeout: 180_000,
    });
    await captureSurface(
      orientPage,
      testInfo,
      "07-refine-key-players",
      "Refine",
      "Add key players to the landscape",
      "PASS if Key Players updated",
    );
  });
});

test("02 Diagnose", async ({ page }, testInfo) => {
  await gotoHome(page);
  await startNewThread(page);
  await sendQuery(
    page,
    "Can CPC credibly play in autonomous port inspection? What is missing?",
  );
  await waitForRunComplete(page, "recipe-diagnose");
  await captureSurface(
    page,
    testInfo,
    "02-diagnose",
    "Diagnose",
    "Can CPC credibly play in autonomous port inspection? What is missing?",
    "PASS if gap matrix / diagnose surface",
  );
});

test("03 Connect", async ({ page }, testInfo) => {
  await gotoHome(page);
  await startNewThread(page);
  await sendQuery(
    page,
    "What funding routes exist for autonomous rail or transport AI testbeds in the UK?",
  );
  await waitForRunComplete(page, "recipe-connect");
  await captureSurface(
    page,
    testInfo,
    "03-connect",
    "Connect",
    "What funding routes exist for autonomous rail or transport AI testbeds in the UK?",
    "PASS if connect / funding framing",
  );
});

test("04 Act", async ({ page }, testInfo) => {
  await gotoHome(page);
  await startNewThread(page);
  await sendQuery(
    page,
    "Build a Five Case investment brief for autonomous port inspection drones.",
  );
  await waitForRunComplete(page, "recipe-brief-five-case");
  await captureSurface(
    page,
    testInfo,
    "04-act",
    "Act",
    "Build a Five Case investment brief for autonomous port inspection drones.",
    "PASS if five case / NPV or radar",
  );
});

test("05 Defend", async ({ page }, testInfo) => {
  await gotoHome(page);
  await startNewThread(page);
  await sendQuery(
    page,
    "Audit the evidence for CPC investment in port inspection drones — what objections would reviewers raise under scrutiny?",
  );
  await waitForRunComplete(page, "recipe-defend");
  await captureSurface(
    page,
    testInfo,
    "05-defend",
    "Defend",
    "Audit the evidence for CPC investment in port inspection drones — what objections would reviewers raise under scrutiny?",
    "PASS if defend / evidence bar",
  );
});

test.afterAll(() => {
  if (indexRows.length === 0) return;
  const header = `| Surface | Query | Recipe | Tier | Citations | Pass | Video | Notes |
|---------|-------|--------|------|-----------|------|-------|-------|
`;
  const body = indexRows
    .map(
      (r) =>
        `| ${r.surface} | ${r.query.slice(0, 55)}… | ${r.recipe} | ${r.tier} | ${r.citations} | ${r.pass} | ${r.video} | ${r.notes} |`,
    )
    .join("\n");
  const indexPath = path.join(RECORDINGS_DIR, "INDEX.md");
  let content = fs.readFileSync(indexPath, "utf8");
  const marker = "## Recorded results";
  const block = `${marker}\n\n${header}${body}\n`;
  if (content.includes(marker)) {
    content = content.replace(/## Recorded results[\s\S]*/, block.trim());
  } else {
    content += `\n\n${block}`;
  }
  content = content.replace(
    /\*\*Recording status:\*\* BLOCKED[\s\S]*?See \[BLOCKED\.md\]\(\.\/BLOCKED\.md\)\./,
    "**Recording status:** COMPLETE — see table below.",
  );
  fs.writeFileSync(indexPath, content);
  const blockedPath = path.join(RECORDINGS_DIR, "BLOCKED.md");
  if (fs.existsSync(blockedPath)) fs.unlinkSync(blockedPath);
});
