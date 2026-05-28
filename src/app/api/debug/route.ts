/**
 * GET /api/debug
 *
 * Read-only diagnostic endpoint. Returns:
 *   - env var presence/absence (never values, only masked hints)
 *   - live connectivity probe to the Python agent service
 *   - Next.js runtime info
 *
 * Protected by a simple token check: ?token=atlas_debug
 * so it doesn't expose configuration to the open internet.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEBUG_TOKEN = "atlas_debug";

function maskUrl(url: string | undefined): string {
  if (!url) return "(not set)";
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url.length > 0 ? `(set, ${url.length} chars, invalid URL)` : "(set but empty)";
  }
}

function envPresence(key: string): { key: string; present: boolean; hint: string } {
  const val = process.env[key];
  if (val === undefined) return { key, present: false, hint: "(not set)" };
  if (val === "") return { key, present: false, hint: "(set but empty string)" };
  return { key, present: true, hint: maskUrl(val) };
}

async function probeUrl(url: string, path: string): Promise<{
  url: string;
  status: number | null;
  latency_ms: number;
  ok: boolean;
  body?: string;
  error?: string;
}> {
  const target = `${url}${path}`;
  const t0 = Date.now();
  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const latency_ms = Date.now() - t0;
    let body: string | undefined;
    try {
      body = await res.text();
      // Truncate long bodies
      if (body.length > 200) body = body.slice(0, 200) + "…";
    } catch {}
    return { url: target, status: res.status, latency_ms, ok: res.ok, body };
  } catch (err) {
    const latency_ms = Date.now() - t0;
    return {
      url: target,
      status: null,
      latency_ms,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== DEBUG_TOKEN) {
    return NextResponse.json({ error: "forbidden — add ?token=atlas_debug" }, { status: 403 });
  }

  const agentsUrl = (
    process.env.PYTHON_AGENTS_URL ??
    process.env.AGENT_URL ??
    ""
  ).replace(/\/$/, "");

  const ingestUrl = (
    process.env.INGEST_API_URL ??
    process.env.INGEST_URL ??
    ""
  ).replace(/\/$/, "");

  // Parallel probes
  const [agentHealth, agentJarvis, agentAtlas] = await Promise.all([
    agentsUrl ? probeUrl(agentsUrl, "/health") : Promise.resolve(null),
    agentsUrl ? probeUrl(agentsUrl, "/jarvis") : Promise.resolve(null),
    agentsUrl ? probeUrl(agentsUrl, "/atlas") : Promise.resolve(null),
  ]);

  const envVars = [
    envPresence("PYTHON_AGENTS_URL"),
    envPresence("AGENT_URL"),
    envPresence("INGEST_API_URL"),
    envPresence("INGEST_API_TOKEN"),
    envPresence("NEXT_PUBLIC_SUPABASE_URL"),
    envPresence("SUPABASE_SERVICE_KEY"),
    envPresence("ANTHROPIC_API_KEY"),
    envPresence("EXA_API_KEY"),
    envPresence("FALKORDB_HOST"),
    envPresence("POSTGRES_URL"),
  ];

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodejs_version: process.version,
    vercel_region: process.env.VERCEL_REGION ?? "local",
    vercel_env: process.env.VERCEL_ENV ?? "development",
    env_vars: envVars,
    probes: {
      agents_health: agentHealth,
      agents_jarvis: agentJarvis,
      agents_atlas: agentAtlas,
    },
  });
}
