#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Brief v2 save-path smoke test (P10.1 — Tier 1 of the testing strategy
// proposed in src/app/(brief-v2)/RESULTS.md §4a).
//
// This is the implementation of L1 + L4 from the cross-run learning spine,
// not "a useful test". It closes two structural gaps:
//
//   - L1 — "tool wired" ≠ "tool used effectively". Run 3 verified the
//     persistence layer in unit form, but until P10 the production save
//     path silently choked on every patch with `DataCloneError` (P10).
//     A test that exercises the save path end-to-end against the real
//     DB, with the same code path the chat bridge uses, would have
//     caught the bug in seconds rather than days.
//   - L4 — provider scope and integration boundaries hide in green unit
//     tests. The Vitest unit tests for `applyLensPrecedence` were green
//     throughout the P10 incident because they passed plain JSON, not
//     the RSC-deserialised input that tripped `structuredClone`. The
//     smoke test exercises the *real* boundary by going through
//     `pgBriefV2Repository.saveBriefV2` exactly as the Server Action
//     does on the running server.
//
// What it does (in process, no LLM, no browser, no chat panel):
//
//   1. Discover or accept an owner user id (auto-discovery picks the
//      first user with any existing brief; --owner overrides).
//   2. Create a fresh `[SMOKE-TEST]` exploration_one_pager brief.
//   3. Run six assertions covering round-trip integrity, the P10 contract
//      (function/Symbol contaminants survive the save path), patch-style
//      modification persistence, schema-gate behaviour, and Q3 lens
//      propagation.
//   4. Always delete the test brief on the way out (try/finally), unless
//      `--keep-brief` is passed.
//   5. Exit 0 on full pass, exit 1 on any failure.
//
// Usage:
//
//   pnpm exec tsx scripts/smoke-test-brief-v2-save.ts
//   pnpm exec tsx scripts/smoke-test-brief-v2-save.ts --owner <userId>
//   pnpm exec tsx scripts/smoke-test-brief-v2-save.ts --keep-brief
//
// Environment:
//
//   POSTGRES_URL (required) — load-env handles this from .env / .env.local.
//   SMOKE_TEST_USER_ID (optional) — same as --owner.
// ---------------------------------------------------------------------------

import "load-env";

import type { JSONContent } from "@tiptap/core";
import { eq, sql } from "drizzle-orm";

import { pgDb as db } from "@/lib/db/pg/db.pg";
import {
  AtlasBriefClaimsTable,
  AtlasBriefSectionsTable,
  AtlasBriefsTable,
} from "@/lib/db/pg/schema.pg";
import { pgBriefV2Repository } from "@/lib/db/pg/repositories/brief-v2-repository.pg";
import type { AccessScope } from "@/lib/db/pg/repositories/access-scope";
import {
  buildComparisonSheetDoc,
  buildExplorationOnePagerDoc,
} from "@/lib/brief/initial-doc";
import { BriefValidationError } from "@/lib/brief/persistence/validate";
import {
  applyAndValidatePatch,
  ServerPatchValidationError,
} from "@/lib/brief/agent/server-patch";
import type { BriefV2PatchOperation } from "@/lib/brief/agent/tools";
import { ulid } from "ulid";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  ownerId: string | null;
  keepBrief: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let ownerId: string | null = process.env.SMOKE_TEST_USER_ID ?? null;
  let keepBrief = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--owner") {
      ownerId = argv[++i] ?? null;
    } else if (a === "--keep-brief") {
      keepBrief = true;
    }
  }
  return { ownerId, keepBrief };
}

// ---------------------------------------------------------------------------
// Owner discovery — find any user that already owns a brief
// ---------------------------------------------------------------------------

async function discoverOwnerId(): Promise<string | null> {
  const rows = await db
    .select({ ownerId: AtlasBriefsTable.ownerId })
    .from(AtlasBriefsTable)
    .where(sql`${AtlasBriefsTable.briefV2Id} is not null`)
    .orderBy(sql`${AtlasBriefsTable.briefV2UpdatedAt} desc nulls last`)
    .limit(1);
  return rows.length > 0 ? rows[0].ownerId : null;
}

// ---------------------------------------------------------------------------
// Assertion runner
// ---------------------------------------------------------------------------

interface Outcome {
  name: string;
  pass: boolean;
  ms: number;
  detail?: string;
}

async function step(
  name: string,
  fn: () => Promise<void>,
  results: Outcome[],
): Promise<boolean> {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.push({ name, pass: true, ms });
    console.log(`  ✓ ${name} (${ms} ms)`);
    return true;
  } catch (err) {
    const ms = Date.now() - start;
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, pass: false, ms, detail });
    console.error(`  ✗ ${name} (${ms} ms)`);
    console.error(`    detail: ${detail}`);
    if (err instanceof Error && err.stack) {
      console.error(
        `    stack:  ${err.stack.split("\n").slice(1, 4).join("\n            ")}`,
      );
    }
    return false;
  }
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertTrue(cond: boolean, label: string): void {
  if (!cond) {
    throw new Error(`${label}: condition failed`);
  }
}

// ---------------------------------------------------------------------------
// Helpers — clone deeply and mutate doc trees in ways the agent would
// ---------------------------------------------------------------------------

function jsonClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function findRecipeWrapper(doc: JSONContent): JSONContent | null {
  return doc.content?.[0] ?? null;
}

function findSection(doc: JSONContent, type: string): JSONContent | null {
  const recipe = findRecipeWrapper(doc);
  return recipe?.content?.find((c) => c.type === type) ?? null;
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!process.env.POSTGRES_URL) {
    console.error("POSTGRES_URL is required (load-env reads from .env*)");
    process.exit(1);
  }

  console.log("┌─ Brief v2 save-path smoke test (P10.1)");
  const ownerId = args.ownerId ?? (await discoverOwnerId());
  if (!ownerId) {
    console.error(
      "│ no owner id — pass --owner <userId> or set SMOKE_TEST_USER_ID,\n" +
        "│ or seed the DB with at least one brief so auto-discover can\n" +
        "│ pick a valid user.",
    );
    process.exit(1);
  }
  const scope: AccessScope = { kind: "user", userId: ownerId };
  console.log(`│ owner:      ${ownerId}`);

  // -------------------------------------------------------------------------
  // Setup — create a fresh test brief
  // -------------------------------------------------------------------------

  const fixture = buildExplorationOnePagerDoc({ lens: "operator-2030" });
  // Mark the fixture's title so leaked test briefs are easy to spot in
  // the DB if cleanup ever fails.
  if (fixture.doc.attrs) {
    fixture.doc.attrs.title = `[SMOKE-TEST] ${new Date().toISOString()}`;
  }

  const created = await pgBriefV2Repository.createBriefV2(
    {
      ownerId,
      doc: fixture.doc,
      title: `[SMOKE-TEST] ${new Date().toISOString()}`,
    },
    scope,
  );
  const briefV2Id = created.brief.briefV2Id;
  if (!briefV2Id) {
    throw new Error(
      "createBriefV2 returned without a brief_v2_id — schema invariant violated",
    );
  }
  console.log(`│ briefV2Id:  ${briefV2Id}`);
  console.log("│");

  const results: Outcome[] = [];
  let allPass = true;

  try {
    // -----------------------------------------------------------------------
    // A1 — round-trip save preserves content and advances timestamp
    // -----------------------------------------------------------------------

    allPass =
      (await step(
        "A1  round-trip save preserves content + advances timestamp",
        async () => {
          const before = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!before) throw new Error("loadBriefV2 returned null");
          const beforeTs = before.brief.briefV2UpdatedAt?.toISOString() ?? "";
          await new Promise((r) => setTimeout(r, 10)); // ensure clock moves
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: before.doc },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          if (!after) throw new Error("loadBriefV2 (after) returned null");
          const afterTs = after.brief.briefV2UpdatedAt?.toISOString() ?? "";
          assertEq(after.doc.type, before.doc.type, "doc.type preserved");
          assertEq(
            after.doc.attrs?.id,
            before.doc.attrs?.id,
            "brief id preserved",
          );
          assertTrue(
            afterTs > beforeTs,
            `briefV2UpdatedAt did not advance (before=${beforeTs} after=${afterTs})`,
          );
        },
        results,
      )) && allPass;

    // -----------------------------------------------------------------------
    // A2 — P10 contract: function-shaped contaminant survives the save path
    // -----------------------------------------------------------------------

    allPass =
      (await step(
        "A2  P10: function-shaped contaminant in attrs survives save path",
        async () => {
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");
          const dirty = jsonClone(loaded.doc);
          const recipe = findRecipeWrapper(dirty);
          if (!recipe) throw new Error("recipe wrapper missing");
          // Simulate the exact shape Next.js's RSC layer injects when a
          // value can't be serialised — a function that throws when called.
          recipe.attrs = {
            ...(recipe.attrs ?? {}),
            __smokeContaminant: (() => {
              throw new Error("client-reference stub");
            }) as unknown as never,
          };
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: dirty },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          if (!after) throw new Error("re-load returned null");
          const afterRecipe = findRecipeWrapper(after.doc);
          assertEq(
            (afterRecipe?.attrs as { __smokeContaminant?: unknown } | undefined)
              ?.__smokeContaminant,
            undefined,
            "function contaminant should be stripped on the way through normalise",
          );
        },
        results,
      )) && allPass;

    // -----------------------------------------------------------------------
    // A3 — P10 contract: Symbol contaminant in attrs
    // -----------------------------------------------------------------------

    allPass =
      (await step(
        "A3  P10: Symbol contaminant in attrs survives save path",
        async () => {
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");
          const dirty = jsonClone(loaded.doc);
          const exec = findSection(dirty, "executive_summary");
          if (!exec) throw new Error("executive_summary missing");
          exec.attrs = {
            ...(exec.attrs ?? {}),
            __smokeSymbol: Symbol("contaminant") as unknown as never,
          };
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: dirty },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          if (!after) throw new Error("re-load returned null");
          const afterExec = findSection(after.doc, "executive_summary");
          assertEq(
            (afterExec?.attrs as { __smokeSymbol?: unknown } | undefined)
              ?.__smokeSymbol,
            undefined,
            "Symbol contaminant should be stripped",
          );
        },
        results,
      )) && allPass;

    // -----------------------------------------------------------------------
    // A4 — agent-style modification: add a new finding_item
    // -----------------------------------------------------------------------

    allPass =
      (await step(
        "A4  add-finding round-trip lands in DB",
        async () => {
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");
          const dirty = jsonClone(loaded.doc);
          const findings = findSection(dirty, "key_findings");
          if (!findings) throw new Error("key_findings missing");
          const newFindingId = `01SMOKEFINDINGSMOKEFINDING0`; // 26-char ULID
          const marker = "[SMOKE]Innovate UK Dual-use Aviation closes 3 Jun";
          // finding_item.content is `inline*`, not `paragraph+`. Use a
          // plain text node — the same shape `buildExplorationOnePagerDoc`
          // emits for its synthetic finding_0.
          findings.content = [
            ...(findings.content ?? []),
            {
              type: "finding_item",
              attrs: {
                id: newFindingId,
                citations: [],
                confidence: "verified",
              },
              content: [{ type: "text", text: marker }],
            },
          ];
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: dirty },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          if (!after) throw new Error("re-load returned null");
          const afterFindings = findSection(after.doc, "key_findings");
          const ids = (afterFindings?.content ?? [])
            .filter((c) => c.type === "finding_item")
            .map((c) => c.attrs?.id);
          assertTrue(
            ids.includes(newFindingId),
            `expected new finding ${newFindingId} in DB, got ${JSON.stringify(ids)}`,
          );
          // And confirm the surface text actually persisted
          const texts = JSON.stringify(afterFindings?.content ?? []);
          assertTrue(
            texts.includes(marker),
            `expected marker text "${marker}" in stored findings`,
          );
        },
        results,
      )) && allPass;

    // -----------------------------------------------------------------------
    // A5 — schema gate rejects an invalid doc with BriefValidationError
    // -----------------------------------------------------------------------

    allPass =
      (await step(
        "A5  schema gate: invalid doc throws BriefValidationError (NOT DataCloneError)",
        async () => {
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");
          const broken = jsonClone(loaded.doc);
          // Empty out the recipe wrapper's content — violates the
          // exploration_one_pager content expression (which requires a
          // specific section sequence). The schema check should reject this.
          const recipe = findRecipeWrapper(broken);
          if (recipe) recipe.content = [];
          let caught: unknown = null;
          try {
            await pgBriefV2Repository.saveBriefV2(
              { briefV2Id, doc: broken },
              scope,
            );
          } catch (err) {
            caught = err;
          }
          if (!caught) {
            throw new Error(
              "expected save to throw on invalid content expression; it returned ok",
            );
          }
          if (!(caught instanceof BriefValidationError)) {
            throw new Error(
              `expected BriefValidationError, got ${(caught as Error).constructor.name}: ${(caught as Error).message}`,
            );
          }
        },
        results,
      )) && allPass;

    // -----------------------------------------------------------------------
    // A6 — Q3 lens propagation: brief.metadata.lens copied to recipe wrapper
    // -----------------------------------------------------------------------

    allPass =
      (await step(
        "A6  Q3 lens precedence: metadata.lens propagates to recipe wrapper",
        async () => {
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");
          const next = jsonClone(loaded.doc);
          if (next.attrs && next.attrs.metadata) {
            (next.attrs.metadata as { lens?: string }).lens =
              "stakeholder-2025";
          }
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: next },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          if (!after) throw new Error("re-load returned null");
          assertEq(
            (after.doc.attrs?.metadata as { lens?: string } | undefined)?.lens,
            "stakeholder-2025",
            "metadata.lens should round-trip",
          );
          const recipe = findRecipeWrapper(after.doc);
          assertEq(
            (recipe?.attrs as { lens?: string } | undefined)?.lens,
            "stakeholder-2025",
            "recipe wrapper attrs.lens should match canonical metadata.lens",
          );
          assertEq(after.lens, "stakeholder-2025", "loaded.lens accessor");
        },
        results,
      )) && allPass;

    // -----------------------------------------------------------------------
    // A7–A15 — Run 4 Slice 2.3 patch-shape extension.
    //
    // These assertions extend the smoke test to cover the `update_artifact`
    // op shapes the agent emits in production. Each shape is sourced from
    // the in-repo test corpus (`src/lib/brief/__tests__/multi-op-patch.test.ts`,
    // schema-validation tests, the showcase doc) — no synthetic shapes
    // are introduced. The user has explicitly authorised this in-repo-
    // fixture-only fallback; A16 is a tagged `REAL_PAYLOAD_NEEDED`
    // placeholder for a real captured payload to be filled in during
    // live Slice 3 acceptance testing.
    //
    // Each assertion drives the SAME persistence path saveBriefV2 uses,
    // so a green smoke test corresponds to "the agent's op would round-
    // trip correctly". A red assertion is a real production gap.
    //
    // KNOWN-GAP-PRE-SLICE-3A: A12 (comparison_matrix add) is expected to
    // fail until Slice 3a relaxes the recipe content expressions. After
    // Slice 3a, A12 should pass without changes. This is the structural
    // probe that captures the relaxation explicitly.
    // -----------------------------------------------------------------------

    allPass =
      (await step(
        "A7  Run4: single-op replace of a paragraph round-trips through saveBriefV2",
        async () => {
          // Source: multi-op-patch.test.ts:'applies a clean replace and
          // preserves unaffected ULIDs' (single-op sanity).
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");
          const ops: BriefV2PatchOperation[] = [
            {
              op: "replace",
              path: "/content/0/content/0/content/0",
              value: {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "[A7] Replaced executive summary text — Run 4 smoke A7",
                  },
                ],
              },
            },
          ];
          const validated = applyAndValidatePatch(loaded.doc, ops);
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: validated.json },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          const exec = findSection(
            after?.doc as JSONContent,
            "executive_summary",
          );
          const firstPara = exec?.content?.[0];
          const firstText = (
            firstPara?.content as Array<{ text?: string }> | undefined
          )?.[0]?.text;
          assertTrue(
            typeof firstText === "string" && firstText.startsWith("[A7]"),
            `expected A7 marker text, got ${JSON.stringify(firstText)}`,
          );
        },
        results,
      )) && allPass;

    allPass =
      (await step(
        "A8  Run4: triple-drift [remove, add, replace] on key_findings round-trips",
        async () => {
          // Source: multi-op-patch.test.ts:'[remove at 0, add at 0,
          // replace at 0] triple-drift composes correctly'. Same op shape
          // routed through the persistence path.
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");

          // Add a couple of finding_items first so we have something to
          // remove + replace at index 0.
          const seed = jsonClone(loaded.doc);
          const findings = findSection(seed, "key_findings");
          if (!findings) throw new Error("key_findings missing");
          const aId = ulid();
          const bId = ulid();
          const cId = ulid();
          findings.content = [
            {
              type: "finding_item",
              attrs: { id: aId, citations: [], confidence: "verified" },
              content: [{ type: "text", text: "[A8] A" }],
            },
            {
              type: "finding_item",
              attrs: { id: bId, citations: [], confidence: "verified" },
              content: [{ type: "text", text: "[A8] B" }],
            },
            {
              type: "finding_item",
              attrs: { id: cId, citations: [], confidence: "verified" },
              content: [{ type: "text", text: "[A8] C" }],
            },
          ];
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: seed },
            scope,
          );

          const seeded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!seeded) throw new Error("re-load returned null");

          const xId = ulid();
          const yId = ulid();
          const ops: BriefV2PatchOperation[] = [
            { op: "remove", path: "/content/0/content/1/content/0" },
            {
              op: "add",
              path: "/content/0/content/1/content/0",
              value: {
                type: "finding_item",
                attrs: { id: xId, citations: [], confidence: "inferred" },
                content: [{ type: "text", text: "[A8] X" }],
              },
            },
            {
              op: "replace",
              path: "/content/0/content/1/content/0",
              value: {
                type: "finding_item",
                attrs: { id: yId, citations: [], confidence: "uncertain" },
                content: [{ type: "text", text: "[A8] Y" }],
              },
            },
          ];
          const validated = applyAndValidatePatch(seeded.doc, ops);
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: validated.json },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          const afterFindings = findSection(
            after?.doc as JSONContent,
            "key_findings",
          );
          const ids = (afterFindings?.content ?? []).map((c) => c.attrs?.id);
          // Expect [yId, bId, cId]: triple-drift collapses to a single
          // visible Y at position 0; A and X were transient.
          assertEq(ids[0], yId, "position 0 should be Y after triple-drift");
          assertEq(ids[1], bId, "position 1 should be B");
          assertEq(ids[2], cId, "position 2 should be C");
        },
        results,
      )) && allPass;

    allPass =
      (await step(
        "A9  Run4: drift [remove, replace, add] on key_findings round-trips",
        async () => {
          // Source: multi-op-patch.test.ts:'[remove at 0, replace at 1,
          // add at 2] composes against accumulated state'.
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");

          // Reset findings to a known three-item state.
          const seed = jsonClone(loaded.doc);
          const findings = findSection(seed, "key_findings");
          if (!findings) throw new Error("key_findings missing");
          const aId = ulid();
          const bId = ulid();
          const cId = ulid();
          findings.content = [
            {
              type: "finding_item",
              attrs: { id: aId, citations: [], confidence: "verified" },
              content: [{ type: "text", text: "[A9] A" }],
            },
            {
              type: "finding_item",
              attrs: { id: bId, citations: [], confidence: "verified" },
              content: [{ type: "text", text: "[A9] B" }],
            },
            {
              type: "finding_item",
              attrs: { id: cId, citations: [], confidence: "verified" },
              content: [{ type: "text", text: "[A9] C" }],
            },
          ];
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: seed },
            scope,
          );

          const seeded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!seeded) throw new Error("re-load returned null");

          const xId = ulid();
          const yId = ulid();
          const ops: BriefV2PatchOperation[] = [
            { op: "remove", path: "/content/0/content/1/content/0" },
            {
              op: "replace",
              path: "/content/0/content/1/content/1",
              value: {
                type: "finding_item",
                attrs: { id: xId, citations: [], confidence: "verified" },
                content: [{ type: "text", text: "[A9] X" }],
              },
            },
            {
              op: "add",
              path: "/content/0/content/1/content/2",
              value: {
                type: "finding_item",
                attrs: { id: yId, citations: [], confidence: "verified" },
                content: [{ type: "text", text: "[A9] Y" }],
              },
            },
          ];
          const validated = applyAndValidatePatch(seeded.doc, ops);
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: validated.json },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          const afterFindings = findSection(
            after?.doc as JSONContent,
            "key_findings",
          );
          const ids = (afterFindings?.content ?? []).map((c) => c.attrs?.id);
          assertEq(
            ids[0],
            bId,
            "position 0 should be B after [remove,replace,add]",
          );
          assertEq(ids[1], xId, "position 1 should be X");
          assertEq(ids[2], yId, "position 2 should be Y");
        },
        results,
      )) && allPass;

    allPass =
      (await step(
        "A10 Run4: schema-violating multi-op patch is rejected by applyAndValidatePatch",
        async () => {
          // Source: multi-op-patch.test.ts:'rejects a multi-op patch
          // where one op leaves the document schema-invalid'. Two
          // sequential removes empty key_findings, which violates the
          // section's `finding_item+` content expression.
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");

          // Seed findings with exactly two items.
          const seed = jsonClone(loaded.doc);
          const findings = findSection(seed, "key_findings");
          if (!findings) throw new Error("key_findings missing");
          findings.content = [
            {
              type: "finding_item",
              attrs: {
                id: ulid(),
                citations: [],
                confidence: "verified",
              },
              content: [{ type: "text", text: "[A10] A" }],
            },
            {
              type: "finding_item",
              attrs: {
                id: ulid(),
                citations: [],
                confidence: "verified",
              },
              content: [{ type: "text", text: "[A10] B" }],
            },
          ];
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: seed },
            scope,
          );

          const seeded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!seeded) throw new Error("re-load returned null");

          const ops: BriefV2PatchOperation[] = [
            { op: "remove", path: "/content/0/content/1/content/0" },
            { op: "remove", path: "/content/0/content/1/content/0" },
          ];
          let caught: unknown = null;
          try {
            applyAndValidatePatch(seeded.doc, ops);
          } catch (err) {
            caught = err;
          }
          if (!caught) {
            throw new Error(
              "expected applyAndValidatePatch to reject the schema-violating patch",
            );
          }
          if (!(caught instanceof ServerPatchValidationError)) {
            throw new Error(
              `expected ServerPatchValidationError, got ${(caught as Error).constructor.name}`,
            );
          }
          assertEq(
            (caught as ServerPatchValidationError).kind,
            "validation_error",
            "rejection kind",
          );
        },
        results,
      )) && allPass;

    allPass =
      (await step(
        "A11 Run4: add next_step_item to next_steps section round-trips",
        async () => {
          // Source: schema definition (next-steps.node.ts) — next_step_item
          // attrs { id, owner, citations }, content `inline*`. Mirror
          // shape from the recipe seed in initial-doc.ts.
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");

          const next = jsonClone(loaded.doc);
          const nextSteps = findSection(next, "next_steps");
          if (!nextSteps) throw new Error("next_steps section missing");
          const newId = ulid();
          const ops: BriefV2PatchOperation[] = [
            {
              op: "add",
              path: `/content/0/content/3/content/-`,
              value: {
                type: "next_step_item",
                attrs: { id: newId, owner: null, citations: [] },
                content: [
                  {
                    type: "text",
                    text: "[A11] Draft Innovate UK Dual-use proposal by 30 May 2026",
                  },
                ],
              },
            },
          ];
          const validated = applyAndValidatePatch(loaded.doc, ops);
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: validated.json },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          const afterSteps = findSection(
            after?.doc as JSONContent,
            "next_steps",
          );
          const ids = (afterSteps?.content ?? []).map((c) => c.attrs?.id);
          assertTrue(
            ids.includes(newId),
            `expected new next_step_item ${newId}, got ${JSON.stringify(ids)}`,
          );
        },
        results,
      )) && allPass;

    allPass =
      (await step(
        "A12 Run4: add comparison_matrix to exploration_one_pager (KNOWN-GAP-PRE-SLICE-3A)",
        async () => {
          // Source: showcase doc (showcase-doc.ts:fundingMatrix). Adds
          // a comparison_matrix section to the recipe wrapper. Pre-
          // Slice-3a, the exploration_one_pager content expression
          // does NOT permit comparison_matrix and this assertion will
          // fail with a `validation_error`. Post-Slice-3a (after the
          // recipe content expressions are relaxed to the eleven-
          // section disjunction-plus), this assertion should pass.
          //
          // KNOWN-GAP-PRE-SLICE-3A is the structural probe that captures
          // the schema relaxation in machine-checkable form. Until the
          // relaxation lands, an A12 failure with kind=validation_error
          // is the *expected* state and should NOT be silenced.
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");

          const matrixId = ulid();
          const row0 = ulid();
          const row1 = ulid();
          const cellIds = Array.from({ length: 6 }, () => ulid());
          const matrix: JSONContent = {
            type: "comparison_matrix",
            attrs: {
              id: matrixId,
              dimensions: ["funder", "deadline", "grant"],
              version: 1,
            },
            content: [
              {
                type: "matrix_row",
                attrs: { id: row0, option: "innovate_uk_dual_use" },
                content: [
                  {
                    type: "matrix_cell",
                    attrs: {
                      id: cellIds[0],
                      dimension: "funder",
                      citations: [],
                      confidence: "verified",
                    },
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          { type: "text", text: "Innovate UK — Dual-use" },
                        ],
                      },
                    ],
                  },
                  {
                    type: "matrix_cell",
                    attrs: {
                      id: cellIds[1],
                      dimension: "deadline",
                      citations: [],
                      confidence: "verified",
                    },
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "3 June 2026" }],
                      },
                    ],
                  },
                  {
                    type: "matrix_cell",
                    attrs: {
                      id: cellIds[2],
                      dimension: "grant",
                      citations: [],
                      confidence: "verified",
                    },
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "£300k–£1.25m" }],
                      },
                    ],
                  },
                ],
              },
              {
                type: "matrix_row",
                attrs: { id: row1, option: "horizon_europe_infra" },
                content: [
                  {
                    type: "matrix_cell",
                    attrs: {
                      id: cellIds[3],
                      dimension: "funder",
                      citations: [],
                      confidence: "inferred",
                    },
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          { type: "text", text: "Horizon Europe — RI 2026" },
                        ],
                      },
                    ],
                  },
                  {
                    type: "matrix_cell",
                    attrs: {
                      id: cellIds[4],
                      dimension: "deadline",
                      citations: [],
                      confidence: "verified",
                    },
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "10 June 2026" }],
                      },
                    ],
                  },
                  {
                    type: "matrix_cell",
                    attrs: {
                      id: cellIds[5],
                      dimension: "grant",
                      citations: [],
                      confidence: "verified",
                    },
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "€1m–€10m" }],
                      },
                    ],
                  },
                ],
              },
            ],
          };
          const ops: BriefV2PatchOperation[] = [
            {
              op: "add",
              path: "/content/0/content/-",
              value: matrix,
            },
          ];
          const validated = applyAndValidatePatch(loaded.doc, ops);
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: validated.json },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          const afterMatrix = findSection(
            after?.doc as JSONContent,
            "comparison_matrix",
          );
          assertTrue(
            afterMatrix !== null,
            "expected comparison_matrix to be present after save (Slice 3a relaxation)",
          );
          assertEq(
            afterMatrix?.attrs?.id,
            matrixId,
            "comparison_matrix.attrs.id should match",
          );
          assertEq(
            (afterMatrix?.content?.length ?? 0) >= 2,
            true,
            "comparison_matrix should have ≥ 2 rows after save",
          );
        },
        results,
      )) && allPass;

    allPass =
      (await step(
        "A13 Run4: replace section attrs (key_findings.version) round-trips",
        async () => {
          // Source: schema definition (key-findings.node.ts) —
          // key_findings.attrs { id, claims, version }. Replace the
          // entire attrs object via JSON Patch.
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");

          const findings = findSection(loaded.doc, "key_findings");
          if (!findings) throw new Error("key_findings missing");
          const newVersion = (findings.attrs?.version ?? 1) + 1;
          const ops: BriefV2PatchOperation[] = [
            {
              op: "replace",
              path: "/content/0/content/1/attrs",
              value: {
                ...findings.attrs,
                version: newVersion,
              },
            },
          ];
          const validated = applyAndValidatePatch(loaded.doc, ops);
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: validated.json },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          const afterFindings = findSection(
            after?.doc as JSONContent,
            "key_findings",
          );
          assertEq(
            afterFindings?.attrs?.version,
            newVersion,
            "key_findings.attrs.version should round-trip",
          );
        },
        results,
      )) && allPass;

    allPass =
      (await step(
        "A14 Run4: add question_item to open_questions round-trips",
        async () => {
          // Source: schema definition (open-questions.node.ts) and the
          // recipe seed in initial-doc.ts.
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");

          const oq = findSection(loaded.doc, "open_questions");
          if (!oq) throw new Error("open_questions missing");

          const newQId = ulid();
          const ops: BriefV2PatchOperation[] = [
            {
              op: "add",
              path: "/content/0/content/2/content/-",
              value: {
                type: "question_item",
                attrs: { id: newQId, citations: [] },
                content: [
                  {
                    type: "question_text",
                    content: [
                      {
                        type: "text",
                        text: "[A14] Are EU-Rail JU consortia open to UK-led leads in 2027?",
                      },
                    ],
                  },
                ],
              },
            },
          ];
          const validated = applyAndValidatePatch(loaded.doc, ops);
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: validated.json },
            scope,
          );
          const after = await pgBriefV2Repository.loadBriefV2(briefV2Id, scope);
          const afterOq = findSection(
            after?.doc as JSONContent,
            "open_questions",
          );
          const ids = (afterOq?.content ?? []).map((c) => c.attrs?.id);
          assertTrue(
            ids.includes(newQId),
            `expected question_item ${newQId} after save, got ${JSON.stringify(ids)}`,
          );
        },
        results,
      )) && allPass;

    allPass =
      (await step(
        "A15 Run4: citation mark on a finding propagates to the claims index",
        async () => {
          // Source: brief-v2-repository.pg.test.ts:'preserves citation
          // marks and claim provenance through save/load'. Demonstrates
          // that an `add` op carrying a citation mark on a text node
          // produces a claim row in atlas.brief_claims after save.
          const loaded = await pgBriefV2Repository.loadBriefV2(
            briefV2Id,
            scope,
          );
          if (!loaded) throw new Error("load returned null");

          const claimId = ulid();
          const findingId = ulid();
          const ops: BriefV2PatchOperation[] = [
            {
              op: "add",
              path: "/content/0/content/1/content/-",
              value: {
                type: "finding_item",
                attrs: {
                  id: findingId,
                  citations: [claimId],
                  confidence: "inferred",
                },
                content: [
                  {
                    type: "text",
                    text: "[A15] GPS-denied UAS demand spikes Q3 2026",
                    marks: [
                      {
                        type: "citation",
                        attrs: {
                          id: claimId,
                          sources: ["src-A15-fixture"],
                          confidence: "inferred",
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ];
          const validated = applyAndValidatePatch(loaded.doc, ops);
          await pgBriefV2Repository.saveBriefV2(
            { briefV2Id, doc: validated.json },
            scope,
          );
          const claims = await pgBriefV2Repository.listBriefClaims(
            briefV2Id,
            scope,
          );
          const persisted = claims.find((c) => c.id === claimId);
          assertTrue(
            persisted !== undefined,
            `expected claim ${claimId} in claims index after add`,
          );
          assertEq(
            persisted?.confidence,
            "inferred",
            "claim.confidence should round-trip from citation mark",
          );
          assertEq(
            JSON.stringify(persisted?.sources ?? []),
            JSON.stringify(["src-A15-fixture"]),
            "claim.sources should round-trip",
          );
        },
        results,
      )) && allPass;

    // -----------------------------------------------------------------------
    // A16 — REAL captured LLM `update_artifact` payload.
    //
    // The fixture at `.tmp/run-4-a16-captured-payload.json` is the actual
    // operations array emitted by GPT-4.1 during the headline acceptance
    // test on 2026-05-08, against a `comparison_sheet`-seeded brief in
    // response to the user prompt:
    //
    //     "Build me a funding-call comparison table for the four
    //      Innovate UK and EU calls relevant to GPS-denied UAS, with
    //      confidence pills and a bar chart of corpus distribution."
    //
    // The captured payload contains four operations:
    //   - replace at /content/0/content/1 → comparison_matrix (4 rows
    //     × 4 cells = 16 cells, real funding-call data, citations,
    //     confidence states)
    //   - add at /content/0/content/-    → evidence_visualisation
    //     (chart_type: "bar", live data points)
    //   - remove at /content/0/content/2 → key_findings
    //   - remove at /content/0/content/3 → recommendation
    //
    // Note on the real-world finding from the capture:
    //   The agent's two `remove` ops (positions 2 and 3, addressing the
    //   ORIGINAL section indices) compose against accumulated state per
    //   RFC 6902 (and `applyAndValidatePatch` semantics): after op[2]
    //   removes index 2, op[3]'s index 3 now points to a different
    //   section than the agent intended. This is a position-drift bug
    //   in the agent's reasoning, not a schema or persistence bug. The
    //   resulting document is still schema-valid (just missing one
    //   intended section); A16 asserts the schema-valid round-trip,
    //   not the agent's intended layout.
    //
    // Closes the [REAL_PAYLOAD_NEEDED] gap surfaced in RESULTS.md R4.2.
    // -----------------------------------------------------------------------

    allPass =
      (await step(
        "A16 Run4: real captured LLM update_artifact payload (2026-05-08, comparison_sheet) round-trips schema-valid",
        async () => {
          const fixturePath = ".tmp/run-4-a16-captured-payload.json";
          let captured: {
            operations: BriefV2PatchOperation[];
            change_summary?: string;
            base_updated_at?: string;
          };
          try {
            captured = JSON.parse(readFileSync(fixturePath, "utf8"));
          } catch (err) {
            throw new Error(
              `failed to read A16 fixture at ${fixturePath}: ${(err as Error).message}`,
            );
          }
          assertTrue(
            Array.isArray(captured.operations) &&
              captured.operations.length >= 1,
            "fixture must carry a non-empty operations array",
          );

          // The captured payload carries the original ULIDs the live
          // agent minted on 2026-05-08. Those IDs may still live in
          // `atlas.brief_sections` / `atlas.brief_claims` for the
          // original test brief, and re-using them in a fresh A16
          // brief would violate the per-brief PRIMARY KEY constraints.
          // Refresh every `attrs.id` (sections, rows, cells, claims,
          // citation marks) in the payload while preserving op shape,
          // paths, content text, dimensions, citations, and confidence
          // states. The "real shape" property the smoke test exists to
          // exercise is the op structure, not the literal ID strings.
          const refreshIdsInValue = (value: unknown): unknown => {
            if (Array.isArray(value)) {
              return value.map((v) => refreshIdsInValue(v));
            }
            if (value && typeof value === "object") {
              const obj = value as Record<string, unknown>;
              const next: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(obj)) {
                if (k === "attrs" && v && typeof v === "object") {
                  const attrs = v as Record<string, unknown>;
                  const nextAttrs: Record<string, unknown> = { ...attrs };
                  if (typeof attrs.id === "string" && attrs.id.length === 26) {
                    nextAttrs.id = ulid();
                  }
                  next[k] = nextAttrs;
                } else {
                  next[k] = refreshIdsInValue(v);
                }
              }
              return next;
            }
            return value;
          };
          const refreshedOperations = captured.operations.map((op) => ({
            ...op,
            value:
              op.value !== undefined ? refreshIdsInValue(op.value) : op.value,
          })) as BriefV2PatchOperation[];

          // Provision a fresh comparison_sheet brief so the captured
          // ops' /content/0/content/1 path lands on a comparison_matrix
          // (matching the original capture context).
          const a16Fixture = buildComparisonSheetDoc({ lens: "operator-2030" });
          if (a16Fixture.doc.attrs) {
            a16Fixture.doc.attrs.title = `[A16-CAPTURE] ${new Date().toISOString()}`;
          }
          const a16Created = await pgBriefV2Repository.createBriefV2(
            {
              ownerId,
              doc: a16Fixture.doc,
              title: `[A16-CAPTURE] ${new Date().toISOString()}`,
            },
            scope,
          );
          const a16BriefV2Id = a16Created.brief.briefV2Id;
          if (!a16BriefV2Id) {
            throw new Error("A16 fixture brief lacks brief_v2_id");
          }

          try {
            const validated = applyAndValidatePatch(
              a16Created.doc,
              refreshedOperations,
            );
            await pgBriefV2Repository.saveBriefV2(
              { briefV2Id: a16BriefV2Id, doc: validated.json },
              scope,
            );

            const after = await pgBriefV2Repository.loadBriefV2(
              a16BriefV2Id,
              scope,
            );
            if (!after) throw new Error("A16 brief not found post-save");

            const recipeWrapper = (after.doc as JSONContent).content?.[0];
            const sections = Array.isArray(recipeWrapper?.content)
              ? recipeWrapper!.content!
              : [];
            const matrix = sections.find((s) => s.type === "comparison_matrix");
            assertTrue(
              matrix !== undefined,
              "expected comparison_matrix in persisted brief after applying captured payload",
            );
            assertTrue(
              Array.isArray(matrix?.content) && matrix!.content!.length === 4,
              `expected exactly 4 matrix rows from captured payload; got ${matrix?.content?.length ?? 0}`,
            );
            // Each row must carry an option label sourced from the
            // captured agent payload (real funding-call names).
            const rowOptions = matrix!.content!.map(
              (r) => r.attrs?.option as string | undefined,
            );
            assertTrue(
              rowOptions.every((o) => typeof o === "string" && o.length > 0),
              `expected every matrix row to carry an option label; got ${JSON.stringify(rowOptions)}`,
            );
          } finally {
            // Cleanup the A16-specific brief so subsequent runs start
            // clean.
            try {
              await pgBriefV2Repository.deleteBriefV2(a16BriefV2Id, scope);
            } catch {
              // best-effort cleanup; harmless if the brief is already gone
            }
          }
        },
        results,
      )) && allPass;
  } finally {
    // -----------------------------------------------------------------------
    // Cleanup — delete the test brief unless --keep-brief is set
    // -----------------------------------------------------------------------
    if (args.keepBrief) {
      console.log(`│ --keep-brief set: leaving brief ${briefV2Id} in DB`);
    } else {
      try {
        // Cascade: clear denormalised rows first, then the brief row.
        await db
          .delete(AtlasBriefClaimsTable)
          .where(eq(AtlasBriefClaimsTable.briefId, created.brief.id));
        await db
          .delete(AtlasBriefSectionsTable)
          .where(eq(AtlasBriefSectionsTable.briefId, created.brief.id));
        await db
          .delete(AtlasBriefsTable)
          .where(eq(AtlasBriefsTable.id, created.brief.id));
        console.log(`│ cleanup:    deleted brief ${briefV2Id}`);
      } catch (err) {
        console.error(`│ cleanup FAILED for brief ${briefV2Id}: ${err}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const totalMs = results.reduce((sum, r) => sum + r.ms, 0);
  console.log("│");
  console.log(
    `└─ ${passed}/${results.length} passed, ${failed} failed (${totalMs} ms total)`,
  );

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke test fatal error:", err);
  process.exit(1);
});
