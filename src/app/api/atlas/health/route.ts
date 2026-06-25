/**
 * GET /api/atlas/health — agent + corpus tier probes for Atlas v5 (Vercel-safe).
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TierProbe = {
  configured?: boolean;
  status?: "ok" | "fail" | "skip";
  attempts?: number;
  latency_ms?: number;
  error?: string | null;
};

export async function GET() {
  const agentsUrl = (process.env.PYTHON_AGENTS_URL ?? "http://localhost:8000").replace(
    /\/$/,
    "",
  );

  try {
    const res = await fetch(`${agentsUrl}/health`, { cache: "no-store" });
    const health = res.ok ? await res.json() : null;
    const agentsOk = health?.status === "ok";
    const corpus = health?.corpus ?? {};
    const corpusOk = corpus.ok === true;
    const pg = (corpus.postgres ?? {}) as TierProbe;
    const rest = (corpus.rest ?? {}) as TierProbe;

    return NextResponse.json({
      ok: agentsOk,
      agents: {
        ok: agentsOk,
        url: agentsUrl,
      },
      corpus: {
        ok: corpusOk,
        transport: corpus.transport ?? "unknown",
        note: corpus.note ?? null,
        postgres_configured: corpus.postgres_url_set === true,
        supabase_rest_configured: corpus.supabase_rest_set === true,
        /** @deprecated use supabase_rest_configured + rest.status */
        supabase_rest: corpus.supabase_rest_set === true,
        postgres: pg,
        rest,
      },
      web_lane: process.env.ATLAS_V5_WEB_LANE !== "0",
      exa: {
        api_key_set: Boolean(process.env.EXA_API_KEY),
        py_installed: health?.web_lane?.exa_py_installed === true,
        ready:
          health?.web_lane?.enabled !== false &&
          health?.web_lane?.exa_py_installed === true &&
          (health?.web_lane?.exa_api_key_set === true || Boolean(process.env.EXA_API_KEY)),
      },
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
