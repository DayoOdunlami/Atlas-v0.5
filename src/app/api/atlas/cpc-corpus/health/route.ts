/**
 * GET /api/atlas/cpc-corpus/health
 *
 * Returns live database counts and health checks for the CPC Capability
 * Corpus v0.1 ingestion. Queries atlas.evidence_containers, atlas.claims,
 * atlas.claim_evidence_links, and atlas.profile_claims directly.
 *
 * No authentication required — read-only health check.
 */
import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

// ── DB pool ──────────────────────────────────────────────────────────────────

let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  const raw = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  const url = raw.replace(/[?&]sslmode=[^&]*/g, "");
  _pool = new Pool({
    connectionString: url,
    ssl: !url.includes("localhost") ? { rejectUnauthorized: false } : false,
    max: 3,
  });
  return _pool;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CORPUS_TAG = "cpc_v0_1";
const EXPECTED_PROJECTS = 392;
// IMP023 is a Level 3 claim (excluded by governance) → 31 impact + 12 eval + 5 PMO = 48
const EXPECTED_CLAIMS = 48;
const EXPECTED_EVIDENCE_LINKS = 48;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function query<T extends Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

async function queryOne<T extends Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(pool, sql, params);
  return rows[0] ?? null;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const pool = getPool();
  const warnings: string[] = [];

  try {
    // ── Project containers ──────────────────────────────────────────────────
    const projectCount = await queryOne<{ cnt: string }>(
      pool,
      `SELECT COUNT(*)::text AS cnt
       FROM atlas.evidence_containers
       WHERE corpus_tag = $1
         AND container_type IN ('project_evidence_profile','project_evidence')`,
      [CORPUS_TAG],
    );
    const actualProjects = Number(projectCount?.cnt ?? 0);

    // ── Capability Profile container ─────────────────────────────────────────
    const capabilityCount = await queryOne<{ cnt: string }>(
      pool,
      `SELECT COUNT(*)::text AS cnt
       FROM atlas.evidence_containers
       WHERE corpus_tag = $1
         AND container_type = 'capability_profile'`,
      [CORPUS_TAG],
    );
    const actualCapabilityContainers = Number(capabilityCount?.cnt ?? 0);

    // ── By business unit ─────────────────────────────────────────────────────
    const buRows = await query<{ business_unit: string | null; cnt: string }>(
      pool,
      `SELECT COALESCE(business_unit, 'not_found_or_null') AS business_unit,
              COUNT(*)::text AS cnt
       FROM atlas.evidence_containers
       WHERE corpus_tag = $1
         AND container_type IN ('project_evidence_profile','project_evidence')
       GROUP BY business_unit
       ORDER BY COUNT(*) DESC`,
      [CORPUS_TAG],
    );
    const byBusinessUnit: Record<string, number> = {};
    for (const row of buRows) {
      byBusinessUnit[row.business_unit ?? "not_found_or_null"] = Number(row.cnt);
    }

    // ── Claims ───────────────────────────────────────────────────────────────
    const totalClaimsRow = await queryOne<{ cnt: string }>(
      pool,
      `SELECT COUNT(*)::text AS cnt FROM atlas.claims WHERE corpus_tag = $1`,
      [CORPUS_TAG],
    );
    const actualClaims = Number(totalClaimsRow?.cnt ?? 0);

    const byConfidenceRows = await query<{ confidence_tier: string | null; cnt: string }>(
      pool,
      `SELECT COALESCE(confidence_tier,'unknown') AS confidence_tier,
              COUNT(*)::text AS cnt
       FROM atlas.claims
       WHERE corpus_tag = $1
       GROUP BY confidence_tier`,
      [CORPUS_TAG],
    );
    const byConfidence: Record<string, number> = {};
    for (const row of byConfidenceRows) {
      byConfidence[row.confidence_tier ?? "unknown"] = Number(row.cnt);
    }

    const byLevelRows = await query<{ claim_level: number | null; cnt: string }>(
      pool,
      `SELECT COALESCE(claim_level,1) AS claim_level,
              COUNT(*)::text AS cnt
       FROM atlas.claims
       WHERE corpus_tag = $1
       GROUP BY claim_level
       ORDER BY claim_level`,
      [CORPUS_TAG],
    );
    const byLevel: Record<string, number> = {};
    for (const row of byLevelRows) {
      byLevel[String(row.claim_level ?? 1)] = Number(row.cnt);
    }

    // ── Evidence links ────────────────────────────────────────────────────────
    const evidenceLinkRow = await queryOne<{ cnt: string }>(
      pool,
      `SELECT COUNT(*)::text AS cnt
       FROM atlas.claim_evidence_links el
       JOIN atlas.claims c ON c.id = el.claim_id
       WHERE c.corpus_tag = $1`,
      [CORPUS_TAG],
    );
    const actualEvidenceLinks = Number(evidenceLinkRow?.cnt ?? 0);

    // ── Project metadata gaps ─────────────────────────────────────────────────
    const gapQueries: Array<[string, string]> = [
      ["budget", "budget_gbp IS NULL"],
      ["delivery_status", "delivery_status IS NULL"],
      ["end_date", "end_date IS NULL"],
      ["strategic_domain", "TRUE"],   // always 392 — not in schema
      ["strategic_theme", "TRUE"],    // always 392 — not in schema
      ["account_type", "TRUE"],       // always 392 — not in schema
    ];

    const projectMetadataGaps: Record<string, number> = {};
    for (const [label, condition] of gapQueries) {
      if (condition === "TRUE") {
        // These fields were never captured in the ingestion
        projectMetadataGaps[label] = actualProjects;
        continue;
      }
      const gapRow = await queryOne<{ cnt: string }>(
        pool,
        `SELECT COUNT(*)::text AS cnt
         FROM atlas.evidence_containers
         WHERE corpus_tag = $1
           AND container_type IN ('project_evidence_profile','project_evidence')
           AND ${condition}`,
        [CORPUS_TAG],
      );
      projectMetadataGaps[label] = Number(gapRow?.cnt ?? 0);
    }

    // ── Embeddings check ──────────────────────────────────────────────────────
    const noEmbedClaimRow = await queryOne<{ cnt: string }>(
      pool,
      `SELECT COUNT(*)::text AS cnt FROM atlas.claims WHERE corpus_tag=$1 AND embedding IS NULL`,
      [CORPUS_TAG],
    );
    const noEmbedContainerRow = await queryOne<{ cnt: string }>(
      pool,
      `SELECT COUNT(*)::text AS cnt FROM atlas.evidence_containers WHERE corpus_tag=$1 AND embedding IS NULL`,
      [CORPUS_TAG],
    );
    const noEmbedClaims = Number(noEmbedClaimRow?.cnt ?? 0);
    const noEmbedContainers = Number(noEmbedContainerRow?.cnt ?? 0);
    const embeddingsGenerated = noEmbedClaims === 0 && noEmbedContainers === 0;

    // ── Build warnings ────────────────────────────────────────────────────────
    if (actualProjects !== EXPECTED_PROJECTS) {
      warnings.push(
        `project_count mismatch: expected ${EXPECTED_PROJECTS}, actual ${actualProjects}`,
      );
    }
    if (actualCapabilityContainers !== 1) {
      warnings.push(
        `capability_profile_count mismatch: expected 1, actual ${actualCapabilityContainers}`,
      );
    }
    if (actualClaims !== EXPECTED_CLAIMS) {
      warnings.push(
        `claim_count mismatch: expected ${EXPECTED_CLAIMS}, actual ${actualClaims}`,
      );
    }
    if (actualEvidenceLinks < EXPECTED_EVIDENCE_LINKS) {
      warnings.push(
        `evidence_links below expected: expected ${EXPECTED_EVIDENCE_LINKS}, actual ${actualEvidenceLinks}`,
      );
    }
    if (noEmbedClaims > 0) {
      warnings.push(`${noEmbedClaims} claims missing embeddings`);
    }
    if (noEmbedContainers > 0) {
      warnings.push(`${noEmbedContainers} containers missing embeddings`);
    }
    if ((byLevel["3"] ?? 0) > 0) {
      warnings.push(`GOVERNANCE: ${byLevel["3"]} Level 3 claims found — this violates v0.1 governance rules`);
    }

    const response = {
      corpus_version: CORPUS_TAG,
      project_containers: actualProjects,
      capability_profile_container: actualCapabilityContainers,
      by_business_unit: byBusinessUnit,
      claims: {
        total: actualClaims,
        by_confidence: byConfidence,
        by_level: byLevel,
      },
      evidence_links: actualEvidenceLinks,
      evidence_links_complete: actualEvidenceLinks >= EXPECTED_EVIDENCE_LINKS,
      project_metadata_gaps: projectMetadataGaps,
      embeddings_generated: embeddingsGenerated,
      expected_project_containers: EXPECTED_PROJECTS,
      project_count_ok: actualProjects === EXPECTED_PROJECTS,
      expected_claims: EXPECTED_CLAIMS,
      claim_count_ok: actualClaims === EXPECTED_CLAIMS,
      warnings,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // If tables don't exist yet, return a clear not-ready response
    if (message.includes("does not exist") || message.includes("relation")) {
      return NextResponse.json(
        {
          corpus_version: CORPUS_TAG,
          status: "not_ready",
          error: "Schema not yet migrated — run the CPC corpus migration first.",
          detail: message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Health check failed", detail: message },
      { status: 500 },
    );
  }
}
