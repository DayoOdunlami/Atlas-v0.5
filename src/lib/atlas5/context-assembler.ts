/**
 * Atlas 5 — Context Assembler
 *
 * Assembles a ContextPacket for every agent run:
 *   1. Loads skill files from /skills/ based on the active agent
 *   2. Queries Supabase atlas.briefs for prior citations in this thread
 *   3. Returns a ContextPacket ready for injection into the agent system prompt
 *
 * SECURITY: This module is server-only. SUPABASE_SERVICE_KEY is never exposed
 * to client code. All Supabase queries use explicit schema qualifiers.
 */
import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Pool } from "pg";

import type { AgentId, ContextPacket, CorpusCitation, LensId } from "./types";

// ---------------------------------------------------------------------------
// PostgreSQL client (direct — atlas schema not exposed via Supabase REST)
// ---------------------------------------------------------------------------

function makePgPool(): Pool {
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
function pgPool(): Pool {
  if (!_pool) _pool = makePgPool();
  return _pool;
}

// ---------------------------------------------------------------------------
// Skill → agent mapping
// ---------------------------------------------------------------------------

/**
 * Each agent loads a specific subset of skill files.
 * Skills are NEVER called as tools — they are injected as system-prompt context.
 */
const AGENT_SKILLS: Record<AgentId, string[]> = {
  ATLAS: ["green-book", "evidence-triage", "analogue-method"],
  JARVIS: ["evidence-triage"],
  CICERONE: ["evidence-triage", "analogue-method", "green-book"],
  HYVE: ["evidence-triage"],
};

// ---------------------------------------------------------------------------
// Skills loader
// ---------------------------------------------------------------------------

function loadSkill(name: string): { name: string; content: string } {
  const skillsDir = join(process.cwd(), "skills");
  const filePath = join(skillsDir, `${name}.md`);
  const content = readFileSync(filePath, "utf8");
  return { name, content };
}

function loadSkillsForAgent(
  agentId: AgentId,
): Array<{ name: string; content: string }> {
  const names = AGENT_SKILLS[agentId];
  return names.map(loadSkill);
}

// ---------------------------------------------------------------------------
// Prior citations loader
// ---------------------------------------------------------------------------

/**
 * Fetches prior corpus citations from atlas.briefs for this thread.
 *
 * In Brief v2, a thread_id maps to atlas.briefs.id. If no brief exists
 * for the thread_id (new conversation), returns [].
 *
 * Uses direct PostgreSQL — atlas schema is NOT exposed via Supabase REST.
 * Explicit schema qualifier: atlas.briefs.
 */
async function loadPriorCitations(threadId: string): Promise<CorpusCitation[]> {
  try {
    const { rows } = await pgPool().query<{ id: string; title: string }>(
      `
      SELECT id, title
      FROM   atlas.briefs
      WHERE  id = $1::uuid
      LIMIT  1
      `,
      [threadId],
    );

    if (rows.length === 0) {
      // No brief for this thread yet — new conversation
      return [];
    }

    // Brief found — return its ID as a prior reference citation.
    // Richer citation hydration (from atlas.brief_claims) comes at D5.
    return [
      {
        id: rows[0].id,
        title: rows[0].title || "Prior session",
        organisation: "",
      },
    ];
  } catch {
    // DB unavailable or not a valid UUID — return empty
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AssembleContextOptions {
  thread_id: string;
  active_agent: AgentId;
  active_lens: LensId;
}

/**
 * Assembles the full ContextPacket for an agent run.
 *
 * @example
 *   const packet = await assembleContext({
 *     thread_id: "01J...",
 *     active_agent: "JARVIS",
 *     active_lens: "CPC",
 *   });
 */
export async function assembleContext(
  opts: AssembleContextOptions,
): Promise<ContextPacket> {
  const { thread_id, active_agent, active_lens } = opts;

  const [active_skills, prior_citations] = await Promise.all([
    Promise.resolve(loadSkillsForAgent(active_agent)),
    loadPriorCitations(thread_id),
  ]);

  return {
    thread_id,
    active_agent,
    active_lens,
    active_skills,
    prior_citations,
  };
}
