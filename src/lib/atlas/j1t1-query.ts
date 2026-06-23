/**
 * J1T1 — rail decarbonisation corpus query (GATE 1 bootstrap)
 *
 * READ ONLY · atlas.projects via POSTGRES_URL (same path as corpus-queries.ts)
 */
import "server-only";

import { Pool } from "pg";

import type { J1T1CorpusStats } from "@/lib/atlas/j1t1-types";

export type { FunderBreakdownRow, J1T1CorpusStats } from "@/lib/atlas/j1t1-types";

const J1T1_WHERE = `'rail' = ANY(cpc_modes) AND 'decarbonisation' = ANY(cpc_themes)`;

function makePool(): Pool {
  const rawUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  if (!rawUrl) {
    throw new Error("POSTGRES_URL or DATABASE_URL required for J1T1 live query");
  }
  const connectionString = rawUrl.replace(/[?&]sslmode=[^&]*/g, "");
  return new Pool({
    connectionString,
    ssl: rawUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
  });
}

let _pool: Pool | undefined;
function pool(): Pool {
  if (!_pool) _pool = makePool();
  return _pool;
}

export async function fetchJ1T1CorpusStats(): Promise<J1T1CorpusStats> {
  const agg = await pool().query<{
    project_count: number;
    funding_sum: string;
    null_funding_count: number;
    funded_row_count: number;
    org_count: number;
    live_since_2024: number;
  }>(`
    SELECT
      COUNT(*)::int AS project_count,
      COALESCE(SUM(funding_amount), 0)::numeric AS funding_sum,
      COUNT(*) FILTER (WHERE funding_amount IS NULL)::int AS null_funding_count,
      COUNT(*) FILTER (WHERE funding_amount IS NOT NULL)::int AS funded_row_count,
      COUNT(DISTINCT lead_org_name)::int AS org_count,
      COUNT(*) FILTER (
        WHERE end_date IS NULL OR end_date >= '2024-01-01'::date
      )::int AS live_since_2024
    FROM atlas.projects
    WHERE ${J1T1_WHERE}
  `);

  const row = agg.rows[0];
  if (!row) {
    throw new Error("J1T1 aggregate query returned no rows");
  }

  const funderRows = await pool().query<{
    lead_funder: string | null;
    project_count: number;
    null_funding_count: number;
    funding_sum: string;
  }>(`
    SELECT
      COALESCE(lead_funder, 'Unknown') AS lead_funder,
      COUNT(*)::int AS project_count,
      COUNT(*) FILTER (WHERE funding_amount IS NULL)::int AS null_funding_count,
      COALESCE(SUM(funding_amount), 0)::numeric AS funding_sum
    FROM atlas.projects
    WHERE ${J1T1_WHERE}
    GROUP BY lead_funder
    ORDER BY project_count DESC
  `);

  const citationRows = await pool().query<{
    id: string;
    title: string;
    lead_funder: string | null;
    lead_org_name: string | null;
    funding_amount: string | null;
  }>(`
    SELECT id, title, lead_funder, lead_org_name, funding_amount
    FROM atlas.projects
    WHERE ${J1T1_WHERE}
    ORDER BY funding_amount DESC NULLS LAST, title ASC
    LIMIT 5
  `);

  const fundingSum = Number(row.funding_sum);

  return {
    project_count: row.project_count,
    funding_sum: fundingSum,
    null_funding_count: row.null_funding_count,
    funded_row_count: row.funded_row_count,
    org_count: row.org_count,
    live_since_2024: row.live_since_2024,
    funders: funderRows.rows.map((f) => ({
      lead_funder: f.lead_funder ?? "Unknown",
      project_count: f.project_count,
      null_funding_count: f.null_funding_count,
      funding_sum: Number(f.funding_sum),
    })),
    top_citations: citationRows.rows.map((c, i) => ({
      id: c.id,
      title: c.title ?? "Untitled project",
      organisation: c.lead_funder ?? c.lead_org_name ?? "Unknown",
      score: Math.max(0.5, 0.95 - i * 0.05),
    })),
    queried_at: new Date().toISOString(),
  };
}
