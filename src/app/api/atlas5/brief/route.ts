/**
 * POST /api/atlas5/brief   — save a brief artifact to atlas.briefs
 * GET  /api/atlas5/brief   — list recent briefs for the current session
 *
 * Body (POST):
 * {
 *   artifact: ArtifactBlock,
 *   decision_spine?: DecisionSpine,
 *   thread_id?: string,
 *   agent?: string,
 *   lens?: string,
 *   title?: string,
 * }
 *
 * Returns: { ok: true, id: string, created_at: string }
 *
 * SECURITY:
 *   - server-only, POSTGRES_URL never exposed to client
 *   - READ/INSERT only — no UPDATE/DELETE
 *   - No auth gate in dev (NODE_ENV check mirrors /api/copilotkit)
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

let _pool: Pool | undefined;
function pool(): Pool {
  if (!_pool) _pool = makePool();
  return _pool;
}

// ---------------------------------------------------------------------------
// POST — save brief
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { artifact, decision_spine, thread_id, agent, lens, title } =
      body as {
        artifact: Record<string, unknown>;
        decision_spine?: Record<string, unknown>;
        thread_id?: string;
        agent?: string;
        lens?: string;
        title?: string;
      };

    if (!artifact) {
      return NextResponse.json(
        { ok: false, error: "artifact is required" },
        { status: 400 },
      );
    }

    // Derive title from sections if not provided
    const derivedTitle =
      title ??
      (typeof artifact.sections === "object" && artifact.sections !== null
        ? Object.keys(artifact.sections as object)[0]
        : null) ??
      `Brief ${new Date().toLocaleDateString("en-GB")}`;

    const confidenceTier = (artifact.confidence_tier as string | undefined) ?? null;

    const { rows } = await pool().query<{ id: string; created_at: string }>(
      `INSERT INTO atlas.briefs
         (thread_id, agent, lens, title, confidence_tier, artifact_json, decision_spine)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [
        thread_id ?? null,
        agent ?? "ATLAS",
        lens ?? "CPC",
        derivedTitle,
        confidenceTier,
        JSON.stringify(artifact),
        decision_spine ? JSON.stringify(decision_spine) : null,
      ],
    );

    return NextResponse.json({
      ok: true,
      id: rows[0].id,
      title: derivedTitle,
      created_at: rows[0].created_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[brief POST]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET — list recent briefs
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("thread_id");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  try {
    const params: (string | number)[] = [limit];
    let where = "";
    if (threadId) {
      params.unshift(threadId);
      where = "WHERE thread_id = $1";
    }

    const { rows } = await pool().query<{
      id: string;
      thread_id: string | null;
      agent: string;
      lens: string;
      title: string | null;
      confidence_tier: string | null;
      created_at: string;
      artifact_json: Record<string, unknown> | null;
      decision_spine: Record<string, unknown> | null;
    }>(
      `SELECT id, thread_id, agent, lens, title, confidence_tier, created_at,
              artifact_json, decision_spine
       FROM   atlas.briefs
       ${where}
       ORDER  BY created_at DESC
       LIMIT  $${params.length}`,
      params,
    );

    return NextResponse.json({ ok: true, briefs: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[brief GET]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
