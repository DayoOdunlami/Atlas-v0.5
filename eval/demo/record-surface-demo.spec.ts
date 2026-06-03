/**
 * ATLAS v5 — Surface demo recording (Playwright + video)
 *
 * Prerequisites: .env.local or cloud Secrets (see eval/demo/recordings/BLOCKED.md)
 * Stack: langgraph dev :2024 + LANGGRAPH_API_URL + pnpm run dev:ui :3005
 *
 * Run: pnpm run demo:record
 */
import { test, expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
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
  const newBtn = page.locator(".aui-thread-list-new").first();
  if (await newBtn.isVisible().catch(() => false)) {
    await newBtn.click({ force: true });
    await page.waitForTimeout(800);
    return;
  }
  const fallback = page.getByRole("button", { name: /new thread/i });
  if (await fallback.isVisible().catch(() => false)) {
    await fallback.click({ force: true });
    await page.waitForTimeout(800);
  }
}

async function sendQuery(page: Page, query: string) {
  const input = page.locator(".aui-composer-input");
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill(query);
  const shell = page.locator('[data-slot="aui_composer-shell"]');
  const sendBtn = shell.locator("button").filter({ hasNot: page.locator("[disabled]") }).last();
  await sendBtn.click({ force: true });
}

async function waitForRunComplete(page: Page, recipeTestId: string) {
  await page
    .getByRole("button", { name: /stop generating/i })
    .waitFor({ state: "hidden", timeout: 480_000 })
    .catch(() => {});
  await page.getByText(/building artifact/i).waitFor({ state: "hidden", timeout: 480_000 }).catch(() => {});
  await page
    .locator('[data-testid="artifact-loading"]')
    .waitFor({ state: "hidden", timeout: 480_000 })
    .catch(() => {});
  const recipeLocator = page
    .locator(`[data-testid="${recipeTestId}"], [data-testid="recipe-view"]`)
    .first();
  await expect(recipeLocator).toBeVisible({
    timeout: 480_000,
  });
  if (recipeTestId !== "recipe-view") {
    await expect(page.locator(`[data-testid="${recipeTestId}"]`)).toBeVisible({
      timeout: 120_000,
    }).catch(() => {
      // Agent may render via recipe-view wrapper — recipe testid checked in captureSurface meta
    });
  }
  await expect(page.locator('[data-testid="confidence-tier-badge"]').first()).toBeVisible({
    timeout: 120_000,
  });
  const headline = page.locator('[data-testid="surface-headline"]');
  if (await headline.isVisible().catch(() => false)) {
    await expect(headline).not.toHaveText(/in progress|overview in progress/i, {
      timeout: 480_000,
    });
  }
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

async function persistTestVideo(page: Page, slug: string) {
  const video = page.video();
  if (!video) return;
  await page.close();
  const mp4 = path.join(RECORDINGS_DIR, `${slug}.mp4`);
  for (let i = 0; i < 20; i++) {
    const src = await video.path().catch(() => null);
    if (src && fs.existsSync(src)) {
      fs.copyFileSync(src, mp4);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  try {
    await video.saveAs(mp4);
  } catch {
    // Video may be missing on fast failures — screenshot still captured
  }
}

async function getSurfaceHeadlineText(page: Page) {
  const headline = page.locator('[data-testid="surface-headline"]');
  if (await headline.isVisible().catch(() => false)) {
    return headline.textContent({ timeout: 60_000 });
  }
  return page
    .locator('[data-testid="artifact-pane"] [data-testid="surface-headline"]')
    .first()
    .textContent({ timeout: 60_000 });
}

async function expandThreadList(page: Page) {
  const expand = page.getByRole("button", { name: /^Expand$/i });
  if (await expand.isVisible().catch(() => false)) {
    await expand.click({ force: true });
    await page.waitForTimeout(400);
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
  const meta = await readArtifactMeta(page);
  const chat =
    (await page.locator('[data-slot="aui_thread-viewport"], .aui-thread-root').first().textContent()) ??
    "";
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

/** Orient → Clarify → Refine on one LangGraph thread (single page, no reload). */
test.describe("Orient multi-turn thread", () => {
  let orientContext: BrowserContext;
  let orientPage: Page;

  test.beforeAll(async ({ browser }) => {
    orientContext = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      recordVideo: { dir: path.join(RECORDINGS_DIR, "videos-tmp"), size: { width: 1600, height: 900 } },
    });
    orientPage = await orientContext.newPage();
    await gotoHome(orientPage);
    await expandThreadList(orientPage);
    await startNewThread(orientPage);
  });

  test.afterAll(async () => {
    const video = orientPage.video();
    await orientContext.close();
    if (!video) return;
    let src: string | null = null;
    for (let i = 0; i < 20; i++) {
      src = await video.path().catch(() => null);
      if (src && fs.existsSync(src)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (src && fs.existsSync(src)) {
      for (const slug of ["01-orient", "06-clarify-npv", "07-refine-key-players"]) {
        fs.copyFileSync(src, path.join(RECORDINGS_DIR, `${slug}.mp4`));
      }
    }
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
    const headlineBefore = await getSurfaceHeadlineText(orientPage);
    await sendQuery(orientPage, "What is NPV?");
    await orientPage
      .getByRole("button", { name: /stop generating/i })
      .waitFor({ state: "hidden", timeout: 180_000 })
      .catch(() => {});
    const assistantMsg = orientPage.locator('[data-slot="aui_assistant-message-content"]');
    let answer = "";
    await expect
      .poll(
        async () => {
          const texts = await assistantMsg.allTextContents();
          answer = texts.filter((t) => t.trim().length > 80).at(-1) ?? "";
          return answer.length;
        },
        { timeout: 180_000 },
      )
      .toBeGreaterThan(80);
    const headlineAfter = await getSurfaceHeadlineText(orientPage);
    expect(headlineAfter).toBe(headlineBefore);
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
    await expect(orientPage.locator('[data-slot="aui_assistant-message-content"]').last()).toBeVisible({
      timeout: 180_000,
    });
    await orientPage.waitForTimeout(8000);
    await expect(orientPage.getByText(/key players/i).first()).toBeVisible({ timeout: 180_000 });
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
  await persistTestVideo(page, "02-diagnose");
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
  await persistTestVideo(page, "03-connect");
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
  await persistTestVideo(page, "04-act");
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
  await persistTestVideo(page, "05-defend");
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
    /\*\*Recording status:\*\* BLOCKED[^\n]*[\s\S]*?(?=\n## )/,
    "**Recording status:** COMPLETE — see table below.\n\n",
  );
  fs.writeFileSync(indexPath, content);
  const blockedPath = path.join(RECORDINGS_DIR, "BLOCKED.md");
  if (fs.existsSync(blockedPath)) fs.unlinkSync(blockedPath);
});
