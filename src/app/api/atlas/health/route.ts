/**
 * GET /api/atlas/health — agent + corpus probe for Atlas v5 (Vercel-safe).
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const agentsUrl = (process.env.PYTHON_AGENTS_URL ?? "http://localhost:8000").replace(
    /\/$/,
    "",
  );

  try {
    const res = await fetch(`${agentsUrl}/health`, { cache: "no-store" });
    const health = res.ok ? await res.json() : null;
    const agentsOk = health?.status === "ok";
    const corpusOk = health?.corpus?.ok === true;
    const corpusTransport = health?.corpus?.transport ?? "unknown";

    return NextResponse.json({
      ok: agentsOk,
      agents: {
        ok: agentsOk,
        url: agentsUrl,
      },
      corpus: {
        ok: corpusOk,
        transport: corpusTransport,
        note: health?.corpus?.note ?? null,
        postgres_configured: health?.corpus?.postgres_url_set === true,
        supabase_rest: health?.corpus?.supabase_rest_set === true,
      },
      web_lane: process.env.ATLAS_V5_WEB_LANE !== "0",
      anthropic_configured: Boolean(process.env.ANTHROPIC_API_KEY),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        agents: { ok: false, url: agentsUrl },
        corpus: { ok: false, transport: "unavailable" },
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
