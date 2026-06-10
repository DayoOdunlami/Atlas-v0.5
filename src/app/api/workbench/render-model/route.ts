/**
 * GET /api/workbench/render-model?match_id=<uuid>&cq=<canonical_question_id>
 *
 * Milestone 0.5 — returns a DB-backed AtlasRenderModel for a real atlas.matches row.
 * Deterministic builder only (no agents, no LLM, no streaming).
 *
 * Auth: required in production; allowed through in development so the /workbench
 * spike is testable without a session cookie. (getSession uses the admin client,
 * which has no cookie context here.)
 */

import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import {
  buildAtlasRenderModel,
  WorkbenchBuildError,
} from "@/lib/workbench/build-render-model";
import type { CanonicalQuestionId } from "@/lib/workbench/atlas-render-model";

export const runtime = "nodejs";

const VALID_CQ: CanonicalQuestionId[] = [
  "cq.match.browse",
  "cq.match.workbench",
  "cq.match.act",
  "cq.match.defend",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  // Auth gate — enforced in production only.
  if (process.env.NODE_ENV === "production") {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("match_id");
  const cqParam = searchParams.get("cq") ?? "cq.match.workbench";

  // Validate match_id
  if (!matchId) {
    return NextResponse.json(
      { error: "match_id query parameter is required" },
      { status: 400 },
    );
  }
  if (!UUID_RE.test(matchId)) {
    return NextResponse.json(
      { error: "match_id must be a valid UUID" },
      { status: 400 },
    );
  }

  // Validate cq
  if (!VALID_CQ.includes(cqParam as CanonicalQuestionId)) {
    return NextResponse.json(
      {
        error: `cq must be one of: ${VALID_CQ.join(", ")}`,
      },
      { status: 400 },
    );
  }
  const cqId = cqParam as CanonicalQuestionId;

  try {
    const model = await buildAtlasRenderModel(matchId, cqId);
    return NextResponse.json(model);
  } catch (err) {
    if (err instanceof WorkbenchBuildError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[/api/workbench/render-model] error:", detail);
    return NextResponse.json(
      { error: "Failed to build render model", detail },
      { status: 500 },
    );
  }
}
