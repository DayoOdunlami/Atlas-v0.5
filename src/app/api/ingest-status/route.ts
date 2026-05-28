/**
 * /api/ingest-status
 *
 * Aggregates live pipeline state from three sources:
 *   1. Railway ingest service /health  — run state, last_run summary
 *   2. Supabase atlas.ingest_runs      — per-source run ledger
 *   3. Supabase atlas.live_calls       — corpus record counts by source + tag
 *
 * Used by the CorpusHealthPanel component.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const INGEST_URL = (process.env.INGEST_API_URL ?? "").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Supabase admin client (server-side only)
// ---------------------------------------------------------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RailwayHealth {
  status: string;
  running: boolean;
  last_run: {
    source: string;
    dry_run: boolean;
    started: string;
    finished: string;
    exit_code: number;
    triggered_by?: string;
  } | null;
}

interface SourceStat {
  source: string;
  total: number;
  relevant: number;
  borderline: number;
  irrelevant: number;
  untagged: number;
  last_ingested: string | null;
}

interface IngestRun {
  source: string;
  started_at: string;
  finished_at: string | null;
  rows_inserted: number | null;
  rows_updated: number | null;
  rows_skipped: number | null;
  status: string;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET() {
  const [railwayResult, corpusResult, runsResult] = await Promise.allSettled([
    fetchRailwayHealth(),
    fetchCorpusStats(),
    fetchRecentRuns(),
  ]);

  const railway =
    railwayResult.status === "fulfilled" ? railwayResult.value : null;
  const corpus =
    corpusResult.status === "fulfilled" ? corpusResult.value : [];
  const runs =
    runsResult.status === "fulfilled" ? runsResult.value : [];

  // Totals
  const totalRecords = corpus.reduce((s, r) => s + r.total, 0);
  const totalRelevant = corpus.reduce((s, r) => s + r.relevant + r.borderline, 0);
  const totalIrrelevant = corpus.reduce((s, r) => s + r.irrelevant, 0);
  const totalUntagged = corpus.reduce((s, r) => s + r.untagged, 0);

  return NextResponse.json({
    pipeline: {
      running: railway?.running ?? false,
      last_run: railway?.last_run ?? null,
      service_ok: railway !== null,
      ingest_url: INGEST_URL ? new URL(INGEST_URL).hostname : null,
    },
    corpus: {
      total: totalRecords,
      relevant: totalRelevant,
      irrelevant: totalIrrelevant,
      untagged: totalUntagged,
      by_source: corpus,
    },
    recent_runs: runs.slice(0, 20),
    fetched_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// POST — trigger a manual ingest run
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const source: string = body.source ?? "all";
  const dryRun: boolean = body.dry_run ?? false;

  if (!INGEST_URL) {
    return NextResponse.json(
      { error: "INGEST_API_URL is not configured" },
      { status: 503 }
    );
  }

  const token = process.env.INGEST_API_TOKEN ?? "";
  if (!token) {
    return NextResponse.json(
      { error: "INGEST_API_TOKEN is not configured" },
      { status: 503 }
    );
  }

  const resp = await fetch(`${INGEST_URL}/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ source, dry_run: dryRun }),
  });

  const data = await resp.json().catch(() => ({}));
  return NextResponse.json(data, { status: resp.status });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function fetchRailwayHealth(): Promise<RailwayHealth> {
  if (!INGEST_URL) throw new Error("INGEST_API_URL not set");
  const r = await fetch(`${INGEST_URL}/health`, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(8000),
  });
  return r.json();
}

async function fetchCorpusStats(): Promise<SourceStat[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .schema("atlas")
    .from("live_calls")
    .select("source, relevance_tag, scraped_at");

  if (error || !data) return [];

  // Group by source
  const map = new Map<string, SourceStat>();

  for (const row of data as Array<{
    source: string;
    relevance_tag: string | null;
    scraped_at: string | null;
  }>) {
    const src = row.source ?? "unknown";
    if (!map.has(src)) {
      map.set(src, {
        source: src,
        total: 0,
        relevant: 0,
        borderline: 0,
        irrelevant: 0,
        untagged: 0,
        last_ingested: null,
      });
    }
    const s = map.get(src)!;
    s.total++;
    if (row.relevance_tag === "relevant") s.relevant++;
    else if (row.relevance_tag === "borderline") s.borderline++;
    else if (row.relevance_tag === "irrelevant") s.irrelevant++;
    else s.untagged++;

    if (
      row.scraped_at &&
      (!s.last_ingested || row.scraped_at > s.last_ingested)
    ) {
      s.last_ingested = row.scraped_at;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

async function fetchRecentRuns(): Promise<IngestRun[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .schema("atlas")
    .from("ingest_runs")
    .select(
      "source, started_at, finished_at, rows_inserted, rows_updated, rows_skipped, status"
    )
    .order("started_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data as IngestRun[];
}
