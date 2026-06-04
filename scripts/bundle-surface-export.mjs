#!/usr/bin/env node
/**
 * Bundles surface/block/surface-related source into one markdown file
 * for external AI or designers.
 *
 * Usage: node scripts/bundle-surface-export.mjs
 * Output: eval/ATLAS-SURFACES-BUNDLE.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "eval/ATLAS-SURFACES-BUNDLE.md");
const MAX_FILE_BYTES = 120_000;

const FILES = [
  "eval/ui-reference-pack/README.md",
  "eval/ui-reference-pack/SURFACE-BLOCK-CODEMAP.md",
  "eval/ui-reference-pack/SCORECARD.md",
  "eval/ui-reference-pack/EXTERNAL-AI-BRIEF.md",
  "src/lib/atlas5/types.ts",
  "src/lib/atlas5/block-vocabulary.ts",
  "src/lib/atlas5/artifact-schema.ts",
  "src/components/atlas5/block-renderer.tsx",
  "src/components/atlas5/artifact-pane.tsx",
  "src/components/atlas5/atlas-workspace.tsx",
  "src/components/atlas5/recipes/orient-surface.tsx",
  "src/components/atlas5/recipes/connect-surface.tsx",
  "src/components/atlas5/recipes/diagnose-surface.tsx",
  "src/components/atlas5/recipes/defend-surface.tsx",
  "src/components/atlas5/recipes/brief-five-case.tsx",
  "src/components/atlas5/recipes/evidence-panel.tsx",
  "src/components/atlas5/recipes/surface-primitives.tsx",
  "src/components/atlas5/claim-state-badge.tsx",
  "src/components/atlas5/decision-spine.tsx",
  "src/app/lab/blocks/page.tsx",
  "eval/fixtures/artifact-blocks.ts",
  "agents/visual_recipe_director.py",
  "skills/data-visualization.md",
  "skills/surface-composition.md",
];

const parts = [
  "# ATLAS Surfaces & Blocks — bundled export",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "Repo: InnovationAtlas4.0 / Atlas-v0.5",
  "",
  "Use with eval/ui-reference-pack/SCORECARD.md for reviews.",
  "",
  "---",
  "",
];

let totalBytes = 0;
let included = 0;
let skipped = 0;

for (const rel of FILES) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    parts.push(`## MISSING: ${rel}`, "", "_File not found._", "", "---", "");
    skipped++;
    continue;
  }
  const stat = fs.statSync(abs);
  if (stat.size > MAX_FILE_BYTES) {
    parts.push(
      `## ${rel}`,
      "",
      `_Skipped: ${stat.size} bytes exceeds ${MAX_FILE_BYTES}. Read in repo._`,
      "",
      "---",
      "",
    );
    skipped++;
    continue;
  }
  const content = fs.readFileSync(abs, "utf8");
  const ext = path.extname(rel).slice(1) || "text";
  parts.push(`## ${rel}`, "", `\`\`\`${ext}`, content, "```", "", "---", "");
  totalBytes += stat.size;
  included++;
}

parts.push(
  "## Bundle stats",
  "",
  `- Files included: ${included}`,
  `- Files skipped/missing: ${skipped}`,
  `- Approx source bytes: ${totalBytes}`,
  "",
);

fs.writeFileSync(outPath, parts.join("\n"), "utf8");
console.log(`Wrote ${outPath} (${included} files, ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
