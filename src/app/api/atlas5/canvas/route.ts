/**
 * Atlas 5 — Canvas scene persistence (D9)
 *
 * GET  /api/atlas5/canvas?thread_id=...  — load most recent scene for thread
 * POST /api/atlas5/canvas                — save/upsert scene for thread
 *
 * Persists to atlas.canvas_scenes (migration: supabase/migrations/20260520_canvas_scenes.sql)
 * Uses direct PostgreSQL via pg.Pool — atlas schema not exposed via Supabase REST.
 *
 * Security: requires valid session. Service role key is server-only — never in client bundle.
 */
import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

import { getSession } from "@/lib/auth/server";

// ---------------------------------------------------------------------------
// DB pool (reuses pattern from corpus-queries.ts)
// ---------------------------------------------------------------------------

let _pool: Pool | null = null;

function makePool(): Pool {
  if (_pool) return _pool;
  const raw = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  // Strip sslmode from URL — pg handles ssl separately
  const url = raw.replace(/[?&]sslmode=[^&]*/g, "");
  _pool = new Pool({
    connectionString: url,
    ssl: !url.includes("localhost") ? { rejectUnauthorized: false } : false,
    max: 5,
  });
  return _pool;
}

// ---------------------------------------------------------------------------
// GET — load canvas scene
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threadId = req.nextUrl.searchParams.get("thread_id");
  if (!threadId) {
    return NextResponse.json(
      { error: "thread_id is required" },
      { status: 400 },
    );
  }

  try {
    const pool = makePool();
    const result = await pool.query(
      `SELECT scene_json, saved_at, updated_at
       FROM atlas.canvas_scenes
       WHERE thread_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [threadId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ scene_json: null });
    }

    return NextResponse.json({
      scene_json: result.rows[0].scene_json,
      saved_at: result.rows[0].saved_at,
      updated_at: result.rows[0].updated_at,
    });
  } catch (err) {
    console.error("[canvas/GET] DB error:", err);
    return NextResponse.json(
      { error: "Failed to load canvas scene" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — save (upsert) canvas scene
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { thread_id?: string; scene_json?: object };
  try {
    body = (await req.json()) as { thread_id?: string; scene_json?: object };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { thread_id: threadId, scene_json: sceneJson } = body;

  if (!threadId || !sceneJson) {
    return NextResponse.json(
      { error: "thread_id and scene_json are required" },
      { status: 400 },
    );
  }

  try {
    const pool = makePool();

    // Upsert: one scene per thread_id (unique index on thread_id)
    await pool.query(
      `INSERT INTO atlas.canvas_scenes (thread_id, scene_json, saved_at, updated_at)
       VALUES ($1, $2::jsonb, now(), now())
       ON CONFLICT (thread_id) DO UPDATE
         SET scene_json = EXCLUDED.scene_json,
             updated_at = now()`,
      [threadId, JSON.stringify(sceneJson)],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[canvas/POST] DB error:", err);
    return NextResponse.json(
      { error: "Failed to save canvas scene" },
      { status: 500 },
    );
  }
}
