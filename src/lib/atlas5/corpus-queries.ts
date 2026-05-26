/**
 * Atlas 5 — Corpus query helpers (TypeScript, server-side only)
 *
 * Queries atlas.projects, atlas.knowledge_chunks, and hive.articles via
 * direct PostgreSQL (POSTGRES_URL) — NOT via Supabase REST API, which does
 * not expose the atlas or hive schemas.
 *
 * Used by:
 *   - Tier 1 vitest D3 tests (real DB connectivity + ID verification)
 *   - /api/atlas5/search/* routes
 *   - Python MCP server runs equivalent queries independently
 *
 * SECURITY:
 *   - Imports server-only — cannot be imported by client components.
 *   - POSTGRES_URL / SUPABASE_SERVICE_KEY never exposed to the browser.
 *   - READ ONLY — SELECT queries only. Never INSERT/UPDATE/DELETE on atlas.*
 */
import "server-only";

import { Pool } from "pg";

import type { CorpusCitation, HiveCitation } from "./types";

// ---------------------------------------------------------------------------
// PostgreSQL pool (re-uses connection across calls)
// ---------------------------------------------------------------------------

function makePool(): Pool {
  const rawUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  const connectionString = rawUrl.replace(/[?&]sslmode=[^&]*/g, "");
  return new Pool({
    connectionString,
    ssl: rawUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
  });
}

// Lazily created pool — avoids crashing at import time if env vars missing
let _pool: Pool | undefined;
function pool(): Pool {
  if (!_pool) _pool = makePool();
  return _pool;
}

// ---------------------------------------------------------------------------
// atlas.projects
// ---------------------------------------------------------------------------

export interface ProjectSearchResult extends CorpusCitation {
  abstract?: string;
  transport_relevance_score?: number | null;
}

/**
 * Full-text search over atlas.projects title + abstract.
 * Returns records with verified UUIDs from atlas.projects.
 * All queries use explicit schema qualifier: atlas.projects.
 *
 * Strategy: first try matching the full phrase; if <3 results, broaden
 * to search for any significant word from the query individually.
 */
export async function searchProjects(
  query: string,
  limit = 10,
): Promise<ProjectSearchResult[]> {
  const safeLimit = Math.min(Math.max(1, limit), 50);

  const toRows = (
    rows: Array<{
      id: string;
      title: string;
      lead_org_name: string | null;
      abstract: string | null;
      transport_relevance_score: number | null;
    }>,
  ) =>
    rows.map((r) => ({
      id: r.id,
      title: r.title ?? "",
      organisation: r.lead_org_name ?? "",
      abstract: (r.abstract ?? "").slice(0, 300),
      transport_relevance_score: r.transport_relevance_score,
    }));

  // Pass 1: exact phrase match
  const safeTerm = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
  const { rows: pass1 } = await pool().query<{
    id: string;
    title: string;
    lead_org_name: string | null;
    abstract: string | null;
    transport_relevance_score: number | null;
  }>(
    `
    SELECT id, title, lead_org_name, abstract, transport_relevance_score
    FROM   atlas.projects
    WHERE  title    ILIKE $1
       OR  abstract ILIKE $1
    ORDER  BY transport_relevance_score DESC NULLS LAST
    LIMIT  $2
    `,
    [safeTerm, safeLimit],
  );
  if (pass1.length >= 3) return toRows(pass1);

  // Pass 2: try each significant word independently, collect unique IDs
  const words = query
    .split(/\s+/)
    .map((w) => w.replace(/[%_\\]/g, "\\$&"))
    .filter((w) => w.length >= 4);

  if (words.length === 0) return toRows(pass1);

  const conditions = words
    .flatMap((w) => [`title ILIKE '%${w}%'`, `abstract ILIKE '%${w}%'`])
    .join(" OR ");

  const { rows: pass2 } = await pool().query<{
    id: string;
    title: string;
    lead_org_name: string | null;
    abstract: string | null;
    transport_relevance_score: number | null;
  }>(
    `
    SELECT DISTINCT ON (id) id, title, lead_org_name, abstract, transport_relevance_score
    FROM   atlas.projects
    WHERE  ${conditions}
    ORDER  BY id, transport_relevance_score DESC NULLS LAST
    LIMIT  $1
    `,
    [safeLimit],
  );
  return toRows(pass2);
}

/**
 * Fetch a single atlas.projects record by UUID.
 */
export async function getProject(
  projectId: string,
): Promise<ProjectSearchResult | null> {
  const { rows } = await pool().query<{
    id: string;
    title: string;
    lead_org_name: string | null;
    abstract: string | null;
    transport_relevance_score: number | null;
  }>(
    `
    SELECT id, title, lead_org_name, abstract, transport_relevance_score
    FROM   atlas.projects
    WHERE  id = $1
    LIMIT  1
    `,
    [projectId],
  );

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    title: r.title ?? "",
    organisation: r.lead_org_name ?? "",
    abstract: (r.abstract ?? "").slice(0, 500),
    transport_relevance_score: r.transport_relevance_score,
  };
}

/**
 * Verify that all provided UUIDs exist in atlas.projects.
 * Returns the subset of IDs that were found.
 */
export async function verifyProjectIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool().query<{ id: string }>(
    `
    SELECT id
    FROM   atlas.projects
    WHERE  id = ANY($1::uuid[])
    `,
    [ids],
  );
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// atlas.knowledge_chunks
// ---------------------------------------------------------------------------

export interface EvidenceChunk {
  id: string;
  document_id: string | null;
  body: string;
}

/**
 * Search atlas.knowledge_chunks for evidence supporting a claim.
 * READ ONLY — SELECT only. Explicit schema: atlas.knowledge_chunks.
 */
export async function evidenceForClaim(
  claim: string,
  limit = 5,
): Promise<EvidenceChunk[]> {
  const keyTerms = claim
    .split(/\s+/)
    .filter((t) => t.length > 4)
    .slice(0, 3);
  const terms = keyTerms.length > 0 ? keyTerms : claim.split(/\s+/).slice(0, 2);
  const safeLimit = Math.min(Math.max(1, limit), 20);

  // Build WHERE clause: body ILIKE any term
  const conditions = terms.map((_, i) => `body ILIKE $${i + 1}`).join(" OR ");
  const params = [...terms.map((t) => `%${t}%`), safeLimit];

  try {
    const { rows } = await pool().query<{
      id: string;
      document_id: string | null;
      body: string;
    }>(
      `
      SELECT id, document_id, body
      FROM   atlas.knowledge_chunks
      WHERE  ${conditions}
      LIMIT  $${terms.length + 1}
      `,
      params,
    );

    return rows.map((r) => ({
      id: r.id,
      document_id: r.document_id,
      body: (r.body ?? "").slice(0, 400),
    }));
  } catch {
    // knowledge_chunks may not exist or may be empty — return empty gracefully
    return [];
  }
}

// ---------------------------------------------------------------------------
// hive.articles
// ---------------------------------------------------------------------------

export interface HiveSearchResult extends HiveCitation {
  abstract?: string;
}

/**
 * Full-text search over hive.articles.
 * title := project_title (fallback: measure_title) — no bare 'title' column.
 * READ ONLY. Explicit schema: hive.articles.
 */
export async function searchHive(
  query: string,
  limit = 10,
): Promise<HiveSearchResult[]> {
  const safeTerm = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
  const safeLimit = Math.min(Math.max(1, limit), 50);

  // Check which columns actually exist (hive schema may vary)
  const { rows } = await pool().query<{
    id: string;
    project_title: string | null;
    measure_title: string | null;
  }>(
    `
    SELECT id, project_title, measure_title
    FROM   hive.articles
    WHERE  project_title ILIKE $1
       OR  measure_title ILIKE $1
    LIMIT  $2
    `,
    [safeTerm, safeLimit],
  );

  return rows.map((r) => ({
    article_id: r.id,
    title: r.project_title ?? r.measure_title ?? "",
  }));
}

/**
 * Verify that all provided article_ids exist in hive.articles.
 */
export async function verifyHiveArticleIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool().query<{ id: string }>(
    `
    SELECT id
    FROM   hive.articles
    WHERE  id = ANY($1::uuid[])
    `,
    [ids],
  );
  return rows.map((r) => r.id);
}
