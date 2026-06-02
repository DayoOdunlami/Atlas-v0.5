/**
 * GET /api/atlas5/bridges?project_id=<uuid>&limit=5
 *
 * Returns cross-modal bridge projects related to a given project.
 * A "bridge" project is one that spans ≥2 transport modes in its semantic
 * neighbourhood (scored by compute_cross_modal_bridges.py, stored in
 * atlas.cross_modal_bridges).
 *
 * The query finds bridge-scoring projects that are also semantically similar
 * to the given project (cosine similarity via pgvector), surfacing non-obvious
 * cross-sector adjacencies for the passport panel.
 *
 * Query params:
 *   project_id  uuid   required — the reference project to find bridges for
 *   limit       int    optional — max results (default 5, max 10)
 *   min_score   float  optional — min bridge_score threshold (default 0.50)
 *
 * Returns:
 * {
 *   project_id: string,
 *   bridges: Array<{
 *     id: string,
 *     title: string,
 *     lead_funder: string | null,
 *     abstract: string | null,
 *     bridge_score: number,
 *     dominant_pair: string[],
 *     similarity: number,
 *     label: "Very close match" | "Strong link" | "Related",
 *     source_url: string | null,
 *   }>
 * }
 */
import "server-only";

import { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// DB pool
// ---------------------------------------------------------------------------

function makePool(): Pool {
  const rawUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  const connectionString = rawUrl.replace(/[?&]sslmode=[^&]*/g, "");
  return new Pool({
    connectionString,
    ssl: rawUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 30_000,
  });
}

let _pool: Pool | null = null;
function pool(): Pool {
  if (!_pool) _pool = makePool();
  return _pool;
}

// ---------------------------------------------------------------------------
// Score → plain-English label
// ---------------------------------------------------------------------------

function similarityLabel(score: number): "Very close match" | "Strong link" | "Related" {
  if (score >= 0.85) return "Very close match";
  if (score >= 0.70) return "Strong link";
  return "Related";
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "5", 10), 10);
  const minScore = parseFloat(searchParams.get("min_score") ?? "0.50");

  if (!projectId) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 },
    );
  }

  // Basic UUID format check — guards against SQL injection via parameter
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
    return NextResponse.json(
      { error: "project_id must be a valid UUID" },
      { status: 400 },
    );
  }

  try {
    const { rows } = await pool().query<{
      id: string;
      title: string;
      lead_funder: string | null;
      abstract: string | null;
      bridge_score: number;
      dominant_pair: string[];
      similarity: number;
      source_url: string | null;
    }>(
      `SELECT
         p.id::text,
         p.title,
         p.lead_funder,
         p.abstract,
         cmb.bridge_score::float,
         cmb.dominant_pair,
         (1 - (p.embedding <=> ref.embedding))::float AS similarity,
         COALESCE(
           p.source_url,
           CASE WHEN p.gtr_id IS NOT NULL
                THEN 'https://gtr.ukri.org/projects?ref=' || p.gtr_id
                ELSE NULL END
         ) AS source_url
       FROM atlas.cross_modal_bridges cmb
       JOIN atlas.projects p   ON p.id = cmb.entity_id::uuid
       JOIN atlas.projects ref ON ref.id = $1::uuid
       WHERE cmb.entity_id::text != $1
         AND p.embedding IS NOT NULL
         AND ref.embedding IS NOT NULL
         AND cmb.bridge_score >= $2
         AND (1 - (p.embedding <=> ref.embedding)) >= 0.50
       ORDER BY similarity DESC
       LIMIT $3`,
      [projectId, minScore, limit],
    );

    return NextResponse.json({
      project_id: projectId,
      bridges: rows.map((r) => ({
        id: r.id,
        title: r.title,
        lead_funder: r.lead_funder,
        abstract: r.abstract ? r.abstract.slice(0, 300) : null,
        bridge_score: r.bridge_score,
        dominant_pair: r.dominant_pair ?? [],
        similarity: r.similarity,
        label: similarityLabel(r.similarity),
        source_url: r.source_url,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bridges GET]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
