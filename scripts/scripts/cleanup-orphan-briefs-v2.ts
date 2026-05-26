#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Brief v2 orphan cleanup (Run 4 Slice 2.4).
//
// Find Brief v2 rows in `atlas.briefs` that match the structural orphan
// predicate and hard-delete them via the repository's cascade-aware
// delete path.
//
// Predicate (locked at user input on 2026-05-08):
//
//     metadata->>'brief_v2_thread_id' IS NULL
//   AND zero rows in atlas.brief_claims for this brief
//   AND deleted_at IS NULL
//
// No time window. The predicate is structural — the user reported ~15
// orphan briefs from a `create_brief` loop, and any brief without a
// thread binding AND without claims is, by definition, an orphan
// regardless of when it was created.
//
// Safety rails (mandatory):
//
//   1. --dry-run is the default. Prints the candidate set (id, title,
//      created_at, owner) and exits without deleting.
//   2. --apply is required to actually delete. Without it, the script
//      refuses to mutate.
//   3. Non-local POSTGRES_URL is hard-blocked. Only `localhost`,
//      `127.0.0.1`, and `::1` are accepted as hosts. Staging/prod
//      cleanup is a separate conscious decision and cannot be invoked
//      via this script.
//
// Usage:
//
//   pnpm exec tsx scripts/cleanup-orphan-briefs-v2.ts            # dry-run
//   pnpm exec tsx scripts/cleanup-orphan-briefs-v2.ts --dry-run  # explicit
//   pnpm exec tsx scripts/cleanup-orphan-briefs-v2.ts --apply    # DESTRUCTIVE
//   pnpm exec tsx scripts/cleanup-orphan-briefs-v2.ts --owner <userId> --apply
//
// `--owner <userId>` scopes the cleanup to a single user. Without it the
// script runs in system-scope mode (all users). Both modes respect the
// dry-run / apply safety rails.
//
// Output is intentionally human-readable: a candidate table, a before /
// after row count, and a final summary. Capture stdout to a `.txt`
// file for the PR artefact (per src/components/brief-v2/PLAN.md §6).
// ---------------------------------------------------------------------------

import "load-env";
import { sql } from "drizzle-orm";

import { pgDb as db } from "@/lib/db/pg/db.pg";
import { AtlasBriefsTable } from "@/lib/db/pg/schema.pg";
import {
  pgBriefV2Repository,
  type OrphanBriefV2Summary,
} from "@/lib/db/pg/repositories/brief-v2-repository.pg";
import type { AccessScope } from "@/lib/db/pg/repositories/access-scope";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  ownerId: string | null;
  apply: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let ownerId: string | null = null;
  let apply = false;
  let dryRun = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--owner") {
      ownerId = argv[++i] ?? null;
    } else if (a === "--apply") {
      apply = true;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--help" || a === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      printUsage();
      process.exit(2);
    }
  }
  return { ownerId, apply, dryRun };
}

function printUsage(): void {
  console.log(`Usage:
  pnpm exec tsx scripts/cleanup-orphan-briefs-v2.ts            # dry-run (safe default)
  pnpm exec tsx scripts/cleanup-orphan-briefs-v2.ts --dry-run  # explicit dry-run
  pnpm exec tsx scripts/cleanup-orphan-briefs-v2.ts --apply    # DESTRUCTIVE — hard-delete
  pnpm exec tsx scripts/cleanup-orphan-briefs-v2.ts --owner <uid> [--apply | --dry-run]

Predicate: metadata->>'brief_v2_thread_id' IS NULL
       AND zero rows in atlas.brief_claims for this brief
       AND deleted_at IS NULL.

Safety rails: dry-run is default; --apply is required to delete; non-local
POSTGRES_URL is hard-blocked.`);
}

// ---------------------------------------------------------------------------
// Local-only DB hard-block (Input 3 from the user)
// ---------------------------------------------------------------------------

const LOCAL_HOST_ALLOW_LIST = new Set<string>([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

function isLocalPostgresUrl(rawUrl: string): boolean {
  try {
    // postgres://user:pass@host:port/db — node:url handles the userinfo.
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    return LOCAL_HOST_ALLOW_LIST.has(host);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Pretty-print helpers
// ---------------------------------------------------------------------------

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function fmtCandidate(row: OrphanBriefV2Summary): string {
  const created =
    (row.briefV2CreatedAt ?? row.createdAt)?.toISOString?.() ?? "-";
  return [
    pad(row.briefV2Id, 26),
    pad(created.slice(0, 19), 19),
    pad(row.ownerId.slice(0, 8) + "…", 9),
    pad((row.recipe ?? "-").slice(0, 22), 22),
    row.title.slice(0, 60),
  ].join("  ");
}

function header(): string {
  return [
    pad("brief_v2_id", 26),
    pad("created_at (UTC)", 19),
    pad("owner", 9),
    pad("recipe", 22),
    "title",
  ].join("  ");
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const apply = args.apply && !args.dryRun;
  if (args.apply && args.dryRun) {
    console.error(
      "ERROR: --apply and --dry-run are mutually exclusive. Pick one.",
    );
    process.exit(2);
  }

  const rawUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  if (!rawUrl) {
    console.error("ERROR: POSTGRES_URL is required (load-env reads .env*).");
    process.exit(1);
  }
  if (!isLocalPostgresUrl(rawUrl)) {
    console.error(
      `ERROR: refusing to run against non-local POSTGRES_URL.\n` +
        `       allowed hosts: ${[...LOCAL_HOST_ALLOW_LIST].join(", ")}.\n` +
        `       parsed host: ${(() => {
          try {
            return new URL(rawUrl).hostname;
          } catch {
            return "(unparseable)";
          }
        })()}\n` +
        `       Staging / production cleanup is intentionally a separate\n` +
        `       conscious decision and cannot be invoked via this script.`,
    );
    process.exit(1);
  }

  console.log("┌─ Brief v2 orphan cleanup");
  console.log(`│ mode:       ${apply ? "APPLY (destructive)" : "DRY RUN"}`);
  console.log(`│ scope:      ${args.ownerId ?? "system (all users)"}`);
  console.log(
    `│ predicate:  metadata.brief_v2_thread_id IS NULL` +
      ` AND zero claims AND deleted_at IS NULL`,
  );
  console.log("│");

  const scope: AccessScope = args.ownerId
    ? { kind: "user", userId: args.ownerId }
    : { kind: "system" };

  // -------------------------------------------------------------------------
  // Pre-count: total Brief v2 rows in scope (informational).
  // -------------------------------------------------------------------------

  const ownerSql = args.ownerId
    ? sql`${AtlasBriefsTable.ownerId} = ${args.ownerId}`
    : sql`TRUE`;
  const beforeRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(AtlasBriefsTable)
    .where(
      sql`${ownerSql} AND ${AtlasBriefsTable.briefV2Id} IS NOT NULL AND ${AtlasBriefsTable.deletedAt} IS NULL`,
    );
  const beforeCount = beforeRows[0]?.count ?? 0;
  console.log(`│ before:     ${beforeCount} Brief v2 rows in scope`);

  // -------------------------------------------------------------------------
  // Candidate enumeration.
  // -------------------------------------------------------------------------

  const candidates =
    await pgBriefV2Repository.listOrphanBriefV2Candidates(scope);
  console.log(`│ orphans:    ${candidates.length} candidate(s)`);
  console.log("│");

  if (candidates.length === 0) {
    console.log("└─ Nothing to do.");
    process.exit(0);
  }

  console.log(`│ ${header()}`);
  console.log(`│ ${"-".repeat(120)}`);
  for (const c of candidates) {
    console.log(`│ ${fmtCandidate(c)}`);
  }
  console.log("│");

  // -------------------------------------------------------------------------
  // Apply (or skip).
  // -------------------------------------------------------------------------

  if (!apply) {
    console.log(
      `│ DRY RUN: re-run with --apply to hard-delete the ${candidates.length} candidate(s).`,
    );
    console.log("│ No rows changed.");
    console.log("└─ done.");
    process.exit(0);
  }

  console.log(`│ APPLY: hard-deleting ${candidates.length} candidate(s) ...`);
  let deleted = 0;
  let failed = 0;
  for (const c of candidates) {
    try {
      // Use the v2 repo's deleteBriefV2 which cascades through
      // brief_sections / brief_claims / brief_matches.
      await pgBriefV2Repository.deleteBriefV2(c.briefV2Id, {
        kind: "user",
        userId: c.ownerId,
      });
      deleted += 1;
      console.log(`│   ✓ deleted ${c.briefV2Id}  (${c.title.slice(0, 50)})`);
    } catch (err) {
      failed += 1;
      console.error(`│   ✗ FAILED ${c.briefV2Id}: ${(err as Error).message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Post-count.
  // -------------------------------------------------------------------------

  const afterRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(AtlasBriefsTable)
    .where(
      sql`${ownerSql} AND ${AtlasBriefsTable.briefV2Id} IS NOT NULL AND ${AtlasBriefsTable.deletedAt} IS NULL`,
    );
  const afterCount = afterRows[0]?.count ?? 0;
  console.log("│");
  console.log(`│ before:     ${beforeCount}`);
  console.log(`│ deleted:    ${deleted}`);
  console.log(`│ failed:     ${failed}`);
  console.log(`│ after:      ${afterCount}`);
  console.log(
    `└─ Done. ${beforeCount - afterCount} row(s) removed; ${failed} error(s).`,
  );

  // Sanity assertion: the after count must equal before - deleted.
  if (afterCount !== beforeCount - deleted) {
    console.warn(
      `WARN: row count delta does not match deleted count. ` +
        `before=${beforeCount} after=${afterCount} deleted=${deleted}. ` +
        `Investigate.`,
    );
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("orphan cleanup fatal error:", err);
  process.exit(1);
});
