/**
 * GET /api/agent-status
 *
 * Server-side probe: pings the Python agent service health endpoint and
 * returns a sanitised status payload. Runs on Node.js so it can read
 * PYTHON_AGENTS_URL without leaking it to the client bundle.
 *
 * force-dynamic: env vars are read at request time, not at build time.
 * Without this, Next.js may evaluate module-level code during the static
 * page-data collection pass where process.env is empty.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";

export async function GET() {
  // Read env vars at request time (not module load time) — essential for
  // force-dynamic routes so we get the real Vercel env values.
  const rawUrl =
    process.env.PYTHON_AGENTS_URL ??
    process.env.AGENT_URL ??
    "";

  const AGENT_BASE = rawUrl.replace(/\/$/, "");

  // Diagnostic: show the host portion only (no credentials) so the client
  // can display where it's actually pointing without leaking secrets.
  const agentHost = AGENT_BASE
    ? (() => {
        try {
          const u = new URL(AGENT_BASE);
          return `${u.protocol}//${u.host}`;
        } catch {
          return AGENT_BASE.slice(0, 60) || "(empty)";
        }
      })()
    : "(not configured)";

  if (!AGENT_BASE) {
    return NextResponse.json(
      {
        connected: false,
        latency_ms: 0,
        model: MODEL,
        error: "PYTHON_AGENTS_URL is not set",
        agent_host: agentHost,
      },
      { status: 200 },
    );
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`${AGENT_BASE}/health`, {
      signal: AbortSignal.timeout(5000), // 5 s timeout
      cache: "no-store",
    });
    const latency_ms = Date.now() - t0;
    if (!res.ok) {
      return NextResponse.json(
        { connected: false, latency_ms, model: MODEL, error: `HTTP ${res.status}`, agent_host: agentHost },
        { status: 200 },
      );
    }
    return NextResponse.json({ connected: true, latency_ms, model: MODEL, agent_host: agentHost });
  } catch (err) {
    const latency_ms = Date.now() - t0;
    const error = err instanceof Error ? err.message : "unreachable";
    return NextResponse.json(
      { connected: false, latency_ms, model: MODEL, error, agent_host: agentHost },
      { status: 200 }, // always 200 — client decides UI state from payload
    );
  }
}
