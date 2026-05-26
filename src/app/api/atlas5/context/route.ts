/**
 * Atlas 5 — Context packet API endpoint
 *
 * GET /api/atlas5/context?thread_id=...&agent=ATLAS&lens=CPC
 *
 * Returns the assembled ContextPacket for the given thread. Used by:
 *   - The Python agent service (pre-run context fetch at D4+)
 *   - Dev tooling / debug
 *
 * SECURITY: server-side only. SUPABASE_SERVICE_KEY is never returned to the client.
 */
import { NextResponse } from "next/server";

import { assembleContext } from "@/lib/atlas5/context-assembler";
import type { AgentId, LensId } from "@/lib/atlas5/types";
import { getSession } from "@/lib/auth/server";

const VALID_AGENTS: AgentId[] = ["ATLAS", "JARVIS", "CICERONE", "HYVE"];
const VALID_LENSES: LensId[] = ["CPC", "Atlas", "Ecosystem", "Funder", "Mode"];

export async function GET(request: Request) {
  // Auth gate
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const thread_id = searchParams.get("thread_id");
  const agent = searchParams.get("agent") as AgentId | null;
  const lens = searchParams.get("lens") as LensId | null;

  // Validate
  if (!thread_id) {
    return NextResponse.json(
      { error: "thread_id is required" },
      { status: 400 },
    );
  }
  if (!agent || !VALID_AGENTS.includes(agent)) {
    return NextResponse.json(
      { error: `agent must be one of: ${VALID_AGENTS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!lens || !VALID_LENSES.includes(lens)) {
    return NextResponse.json(
      { error: `lens must be one of: ${VALID_LENSES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const packet = await assembleContext({
      thread_id,
      active_agent: agent,
      active_lens: lens,
    });

    // Strip skill content from the response for security —
    // full content is only sent to the Python agent service directly.
    return NextResponse.json({
      thread_id: packet.thread_id,
      active_agent: packet.active_agent,
      active_lens: packet.active_lens,
      active_skills: packet.active_skills.map((s) => ({
        name: s.name,
        length: s.content.length,
      })),
      prior_citations: packet.prior_citations,
    });
  } catch (err) {
    console.error("[atlas5/context] Error assembling context:", err);
    return NextResponse.json(
      { error: "Failed to assemble context" },
      { status: 500 },
    );
  }
}
