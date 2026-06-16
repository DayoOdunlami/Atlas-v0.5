/**
 * GET /api/workbench/health — server-side agents + flag probe (works on Vercel preview).
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const agentsUrl = process.env.PYTHON_AGENTS_URL ?? "http://localhost:8000";
  const orchestratorFlag = process.env.ATLAS5_ORCHESTRATOR_V1 === "true";
  const uiOrchestratorFlag = process.env.NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1 === "true";

  try {
    const [healthRes, rootRes] = await Promise.all([
      fetch(`${agentsUrl}/health`, { cache: "no-store" }),
      fetch(`${agentsUrl}/`, { cache: "no-store" }).catch(() => null),
    ]);

    const health = healthRes.ok ? await healthRes.json() : null;
    const root = rootRes?.ok ? await rootRes.json() : null;
    const agentsOrchestrator =
      root?.feature_flags?.orchestrator_v1 === true ||
      root?.feature_flags?.orchestrator_v1 === "true";

    const corpusOk = health?.corpus?.ok === true;
    const agentsOk = health?.status === "ok";

    return NextResponse.json({
      ok:
        agentsOk &&
        corpusOk &&
        orchestratorFlag &&
        uiOrchestratorFlag &&
        agentsOrchestrator,
      agents: {
        ok: agentsOk,
        corpus: corpusOk,
        detail: health?.corpus?.note,
        transport: health?.corpus?.transport,
        orchestrator_v1: agentsOrchestrator,
      },
      flags: {
        ATLAS5_ORCHESTRATOR_V1: orchestratorFlag,
        NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1: uiOrchestratorFlag,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        flags: {
          ATLAS5_ORCHESTRATOR_V1: orchestratorFlag,
          NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1: uiOrchestratorFlag,
        },
      },
      { status: 503 },
    );
  }
}
