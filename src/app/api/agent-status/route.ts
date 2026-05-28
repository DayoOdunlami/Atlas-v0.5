/**
 * GET /api/agent-status
 *
 * Server-side probe: pings the Python agent service health endpoint and
 * returns a sanitised status payload. Runs on Node.js so it can read
 * PYTHON_AGENTS_URL without leaking it to the client bundle.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Revalidate every 30 s via Next.js data cache so rapid client polls
// don't hammer Railway on every request.
export const revalidate = 30;

const AGENT_BASE = (
  process.env.PYTHON_AGENTS_URL ??
  process.env.AGENT_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

const MODEL = "claude-sonnet-4-6";

export async function GET() {
  const t0 = Date.now();
  try {
    const res = await fetch(`${AGENT_BASE}/health`, {
      signal: AbortSignal.timeout(5000), // 5 s timeout
      cache: "no-store",
    });
    const latency_ms = Date.now() - t0;
    if (!res.ok) {
      return NextResponse.json(
        { connected: false, latency_ms, model: MODEL, error: `HTTP ${res.status}` },
        { status: 200 },
      );
    }
    return NextResponse.json({ connected: true, latency_ms, model: MODEL });
  } catch (err) {
    const latency_ms = Date.now() - t0;
    const error = err instanceof Error ? err.message : "unreachable";
    return NextResponse.json(
      { connected: false, latency_ms, model: MODEL, error },
      { status: 200 }, // always 200 — client decides UI state from payload
    );
  }
}
