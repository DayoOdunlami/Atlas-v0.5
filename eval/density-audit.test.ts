// Density audit — Tier 1 outcome test for the workbench UI.
//
// Why this exists:
//   Engineering correctness tests don't catch "the chat font is too small to
//   read" or "the canvas is wasting 60% of the screen." This audit codifies
//   the density rules we want world-class workbench surfaces to follow.
//
//   It scans source files for typography anti-patterns and fails the build
//   when they leak in. When a deliberate exception is needed, add the file
//   path to ALLOWED_FILES with a justification comment.
//
// Rules:
//   R1. No text-[9px] or text-[8px] anywhere — illegible at standard zoom.
//   R2. No text-[10px] in chat / canvas / block files — bump to text-[11px]+.
//   R3. Block bodies use text-sm (14px) or larger for content paragraphs.
//   R4. Demo chat panel exists (proves demo mode is implemented).
//   R5. /workbench/demo route exists.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..");

function walk(dir: string, suffix = ".tsx"): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      out.push(...walk(full, suffix));
    } else if (entry.endsWith(suffix)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Files where a sub-11px font is acceptable.
 * Add new entries with a one-line justification.
 */
const ALLOWED_FILES_BELOW_11PX: Array<{ file: string; reason: string }> = [
  // (intentionally empty — keep it that way)
];

/**
 * Files exempt from the chat/canvas/block density rule.
 * Typically test files or generated artifacts.
 */
const EXEMPT_PATHS = [
  "src/__tests__/",
  "eval/",
  "src/data/",
  "node_modules/",
];

function listWorkbenchSourceFiles(): string[] {
  const roots = [
    resolve(REPO_ROOT, "src/components/workbench"),
    resolve(REPO_ROOT, "src/lib/workbench"),
    resolve(REPO_ROOT, "src/app/workbench"),
  ];
  const seen = new Set<string>();
  for (const root of roots) {
    for (const f of walk(root, ".tsx")) seen.add(f);
  }
  const rel = (abs: string) =>
    abs.replace(REPO_ROOT, "").replace(/\\/g, "/").replace(/^\//, "");
  return Array.from(seen)
    .map(rel)
    .filter((f) => !EXEMPT_PATHS.some((e) => f.includes(e)));
}

describe("Density audit (Tier 1 outcome test)", () => {
  it("R1 — no text-[9px] or text-[8px] anywhere in workbench source", () => {
    const files = listWorkbenchSourceFiles();
    const offenders: string[] = [];
    for (const file of files) {
      const full = resolve(REPO_ROOT, file);
      const src = readFileSync(full, "utf8");
      if (/text-\[(9|8)px\]/.test(src)) {
        offenders.push(file);
      }
    }
    expect(
      offenders.length,
      `Sub-9px text classes found in:\n  ${offenders.join("\n  ")}`,
    ).toBe(0);
  });

  it("R2 — no text-[10px] in workbench source (use text-[11px] or larger)", () => {
    const files = listWorkbenchSourceFiles();
    const offenders: string[] = [];
    for (const file of files) {
      if (ALLOWED_FILES_BELOW_11PX.some((a) => file === a.file)) continue;
      const full = resolve(REPO_ROOT, file);
      const src = readFileSync(full, "utf8");
      if (/text-\[10px\]/.test(src)) {
        offenders.push(file);
      }
    }
    expect(
      offenders.length,
      `text-[10px] found in:\n  ${offenders.join("\n  ")}\n\nUse text-[11px], text-xs, or larger. Tiny labels reduce legibility for first-class UX.`,
    ).toBe(0);
  });

  it("R3 — block shell headlines are text-sm or larger", () => {
    const shell = resolve(REPO_ROOT, "src/components/workbench/shared/block-shell.tsx");
    const src = readFileSync(shell, "utf8");
    expect(src).toContain("text-sm font-semibold");
    expect(src).not.toContain("text-xs font-semibold");
  });

  it("R4 — DemoChatPanel exists with text-sm message bubbles", () => {
    const panel = resolve(
      REPO_ROOT,
      "src/components/workbench/demo/demo-chat-panel.tsx",
    );
    expect(existsSync(panel)).toBe(true);
    const src = readFileSync(panel, "utf8");
    expect(src).toMatch(/text-sm leading-relaxed/);
  });

  it("R5 — /workbench/demo route exists", () => {
    const route = resolve(REPO_ROOT, "src/app/workbench/demo/page.tsx");
    expect(existsSync(route)).toBe(true);
    const src = readFileSync(route, "utf8");
    expect(src).toMatch(/DemoWorkbenchPage/);
    expect(src).toMatch(/scenario/);
  });

  it("R6 — demo fixtures cover the user's requested scenarios", () => {
    const fixtures = resolve(REPO_ROOT, "src/data/demo-fixtures/index.ts");
    expect(existsSync(fixtures)).toBe(true);
    const src = readFileSync(fixtures, "utf8");
    // Required scenarios — the prompts the user explicitly mentioned
    const requiredIds = [
      "top-questions",
      "cpc-swot",
      "innovation-gaps",
      "partners",
      "rail-ai-landscape",
      "transfer-maritime",
      "economic-case",
      "brief",
    ];
    for (const id of requiredIds) {
      expect(src, `Missing demo scenario: ${id}`).toContain(id);
    }
  });

  it("R7 — chat panel uses readable typography (no text-xs message body)", () => {
    const chat = resolve(REPO_ROOT, "src/components/workbench/chat-panel.tsx");
    const src = readFileSync(chat, "utf8");
    // Assistant message bubble should be text-sm minimum
    expect(src).toContain("text-sm bg-background border border-border leading-relaxed");
    // User bubble should be text-sm minimum
    expect(src).toContain("text-sm leading-relaxed");
  });

  it("R8 — artifact canvas uses content-aware FocusGrid", () => {
    const canvas = resolve(
      REPO_ROOT,
      "src/components/workbench/artifact-canvas.tsx",
    );
    const src = readFileSync(canvas, "utf8");
    expect(src).toContain("HALF_WIDTH_BLOCK_TYPES");
    expect(src).toContain("FocusGrid");
    expect(src).toContain("packFocusRows");
  });
});
