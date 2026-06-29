#!/usr/bin/env node
/**
 * Atlas v5 MOT — one command for foundation checks + answer quality report.
 *
 * Usage:
 *   npm run eval:mot              # full (needs dev server + agents for Playwright)
 *   npm run eval:mot:brain        # trajectories only → eval/out/mot-latest.md
 *   SKIP_V5_E2E=1 npm run eval:mot # skip browser layer
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "eval", "out");
const mdPath = path.join(outDir, "mot-latest.md");
const jsonPath = path.join(outDir, "mot-latest.json");

function run(cmd, args, label) {
  console.log(`\n── ${label} ──`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  return r.status ?? 1;
}

function agentsUp() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3005";
  try {
    const r = spawnSync(
      "node",
      ["-e", `fetch('${base}/api/atlas/health').then(r=>r.json()).then(j=>process.exit(j.agents?.ok?0:1)).catch(()=>process.exit(1))`],
      { cwd: root, stdio: "pipe", shell: true },
    );
    return r.status === 0;
  } catch {
    return false;
  }
}

fs.mkdirSync(outDir, { recursive: true });

let code = 0;

code |= run("npm", ["run", "eval:baseline-v06"], "Layer 1 — unit + core trajectories");

const trajIds = [
  "V01_hello",
  "V02_rail_orient_followup",
  "V09_persona_analogy",
  "V03_wewalk_clarify",
].flatMap((id) => ["--id", id]);

code |= run(
  "node",
  [
    "scripts/python-bin.mjs",
    "eval/run_atlas_v5_trajectories.py",
    ...trajIds,
    "--out",
    jsonPath,
    "--markdown",
    mdPath,
  ],
  "Layer 2 — multi-turn answer MOT (markdown report)",
);

if (process.argv.includes("--brain-only") || process.env.MOT_BRAIN_ONLY === "1") {
  console.log("\n(MOT brain-only — skipping Playwright)");
} else if (process.env.SKIP_V5_E2E === "1") {
  console.log("\n(SKIP_V5_E2E=1 — skipping Playwright MOT)");
} else if (!agentsUp()) {
  console.warn("\nDev server/agents offline — skipping Playwright MOT (run npm run dev)");
} else {
  code |= run(
    "npx",
    [
      "playwright",
      "test",
      "--config",
      "eval/playwright.atlas-v5.config.ts",
      "eval/playwright/atlas-v5-mot.spec.ts",
    ],
    "Layer 3 — Playwright infrastructure MOT",
  );
}

console.log(`\n══════════════════════════════════════`);
console.log(`MOT complete. Review: ${path.relative(root, mdPath)}`);
console.log(`Exit code: ${code}`);
process.exit(code);
