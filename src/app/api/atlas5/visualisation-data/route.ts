import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

// Lab-only endpoint. Returns 404 in production to avoid exposing it.
// Queries are read-only SELECT aggregations — no row-level data, no IDs, no secrets.
const SUPPORTED_CASES = [
  "project_timeline",
  "live_calls_landscape",
  "knowledge_authority",
  "semantic_clusters",
  "innovation_map",
  "theme_intersections",
] as const;
type SupportedCase = (typeof SUPPORTED_CASES)[number];

// ---------------------------------------------------------------------------
// DB pool — read-only, shared across requests in this module instance
// ---------------------------------------------------------------------------

let _pool: Pool | null = null;

function db(): Pool {
  if (!_pool) {
    const cs = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
    const isLocal = cs.includes("localhost") || cs.includes("127.0.0.1");
    _pool = new Pool({
      connectionString: cs,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30_000,
    });
  }
  return _pool;
}

async function q<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await db().connect();
  try {
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}

function isUndefinedTable(e: unknown): boolean {
  return (e as { code?: string })?.code === "42P01";
}

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface VisualisationDataResponse {
  ok: boolean;
  case: string;
  renderer: string;
  data_source: string;
  story: string;
  data: Record<string, unknown>[];
  caveats: string[];
  row_count: number;
  error?: string;
}

function success(
  r: Omit<VisualisationDataResponse, "ok" | "row_count">,
): VisualisationDataResponse {
  return { ...r, ok: true, row_count: r.data.length };
}

// ---------------------------------------------------------------------------
// Case: project_timeline
// Aggregates atlas.projects by year using the first temporal column found.
// ---------------------------------------------------------------------------

async function projectTimeline(): Promise<VisualisationDataResponse> {
  // Discover date/timestamp columns — avoids hardcoding schema assumptions.
  const cols = await q<{ column_name: string }>(`
    SELECT column_name
    FROM   information_schema.columns
    WHERE  table_schema = 'atlas'
      AND  table_name   = 'projects'
      AND  data_type IN ('date',
                         'timestamp with time zone',
                         'timestamp without time zone')
    ORDER  BY ordinal_position
    LIMIT  5
  `);

  const PREFERRED = [
    "start_date",
    "created_at",
    "published_date",
    "project_date",
  ];
  const dateCol =
    cols.find((c) => PREFERRED.includes(c.column_name)) ?? cols[0];

  if (!dateCol) {
    // No temporal column — return total count as a single bar
    const total = await q<{ total: number }>(`
      SELECT COUNT(*)::int AS total FROM atlas.projects
    `);
    return success({
      case: "project_timeline",
      renderer: "recharts-bar",
      data_source: "atlas.projects",
      story: `The CPC corpus contains ${total[0]?.total ?? 0} funded innovation projects. No temporal column is available yet for a year-over-year view.`,
      data: [{ label: "Total projects", count: total[0]?.total ?? 0 }],
      caveats: [
        "atlas.projects has no date/timestamp column. Add a start_date column to enable timeline view.",
        "Showing total count only.",
      ],
    });
  }

  const col = dateCol.column_name;
  const rows = await q<{ year: number; count: number }>(`
    SELECT EXTRACT(YEAR FROM ${col})::int AS year,
           COUNT(*)::int                   AS count
    FROM   atlas.projects
    WHERE  ${col} IS NOT NULL
      AND  ${col} > '2005-01-01'
    GROUP  BY 1
    ORDER  BY 1
  `);

  const caveats: string[] = [];
  if (rows.length < 3) {
    caveats.push(
      `Only ${rows.length} data point(s) found using ${col}. Timeline may be sparse.`,
    );
  }

  return success({
    case: "project_timeline",
    renderer: rows.length >= 3 ? "recharts-line" : "recharts-bar",
    data_source: "atlas.projects",
    story: `CPC-funded innovation projects by year (source: ${col}). Covers ${rows.length} years.`,
    data: rows.map((r) => ({ year: r.year, count: Number(r.count) })),
    caveats,
  });
}

// ---------------------------------------------------------------------------
// Case: live_calls_landscape
// Aggregates atlas.live_calls by funder and status.
// ---------------------------------------------------------------------------

async function liveCallsLandscape(): Promise<VisualisationDataResponse> {
  const rows = await q<{ funder: string; status: string; count: number }>(`
    SELECT COALESCE(funder, 'Unknown')  AS funder,
           COALESCE(status, 'unknown')  AS status,
           COUNT(*)::int                AS count
    FROM   atlas.live_calls
    GROUP  BY funder, status
    ORDER  BY count DESC
    LIMIT  50
  `);

  const totalCalls = rows.reduce((s, r) => s + Number(r.count), 0);
  const openCalls = rows
    .filter((r) => r.status === "open")
    .reduce((s, r) => s + Number(r.count), 0);

  const caveats: string[] = [];
  if (rows.length === 0) {
    caveats.push(
      "atlas.live_calls is empty. Populate with funding opportunity data.",
    );
  }

  return success({
    case: "live_calls_landscape",
    renderer: "recharts-stacked",
    data_source: "atlas.live_calls",
    story: `${totalCalls} funding calls indexed across ${new Set(rows.map((r) => r.funder)).size} funders. ${openCalls} currently open.`,
    data: rows.map((r) => ({
      funder: r.funder,
      status: r.status,
      count: Number(r.count),
    })),
    caveats,
  });
}

// ---------------------------------------------------------------------------
// Case: knowledge_authority
// Aggregates atlas.knowledge_documents by source_type and tier.
// ---------------------------------------------------------------------------

async function knowledgeAuthority(): Promise<VisualisationDataResponse> {
  const rows = await q<{
    source_type: string;
    tier: string;
    count: number;
  }>(`
    SELECT COALESCE(source_type, 'unclassified') AS source_type,
           COALESCE(tier,        'unclassified') AS tier,
           COUNT(*)::int                         AS count
    FROM   atlas.knowledge_documents
    WHERE  status = 'approved'
    GROUP  BY source_type, tier
    ORDER  BY count DESC
    LIMIT  40
  `);

  const totalDocs = rows.reduce((s, r) => s + Number(r.count), 0);
  const tiers = new Set(rows.map((r) => r.tier)).size;
  const sources = new Set(rows.map((r) => r.source_type)).size;

  const caveats: string[] = [];
  if (rows.some((r) => r.tier === "unclassified")) {
    caveats.push(
      "Some documents have no tier assigned. Set tier to 'primary', 'secondary', or 'background'.",
    );
  }
  if (totalDocs === 0) {
    caveats.push(
      "No approved knowledge_documents found. Run the approval workflow for ingested documents.",
    );
  }

  return success({
    case: "knowledge_authority",
    renderer: "recharts-bar",
    data_source: "atlas.knowledge_documents (approved)",
    story: `${totalDocs} approved policy documents across ${sources} source types and ${tiers} authority tiers.`,
    data: rows.map((r) => ({
      source_type: r.source_type,
      tier: r.tier,
      count: Number(r.count),
    })),
    caveats,
  });
}

// ---------------------------------------------------------------------------
// Case: semantic_clusters
// Tries atlas.semantic_clusters first; falls back to theme distribution
// from atlas.knowledge_documents.themes (text[] column).
// ---------------------------------------------------------------------------

async function semanticClusters(): Promise<VisualisationDataResponse> {
  // Attempt 1: dedicated clusters table
  try {
    const rows = await q<{ label: string; count: number }>(`
      SELECT cluster_label AS label,
             member_count::int AS count
      FROM   atlas.semantic_clusters
      ORDER  BY member_count DESC
      LIMIT  25
    `);
    if (rows.length > 0) {
      return success({
        case: "semantic_clusters",
        renderer: "recharts-bar",
        data_source: "atlas.semantic_clusters",
        story: `Top ${rows.length} semantic clusters by member count from the Atlas corpus.`,
        data: rows.map((r) => ({ label: r.label, count: Number(r.count) })),
        caveats: [],
      });
    }
  } catch (e) {
    if (!isUndefinedTable(e)) throw e;
    // fall through to theme proxy
  }

  // Attempt 2: theme distribution as a proxy for clusters
  const rows = await q<{ label: string; count: number }>(`
    SELECT unnest(themes) AS label,
           COUNT(*)::int  AS count
    FROM   atlas.knowledge_documents
    WHERE  themes IS NOT NULL
      AND  cardinality(themes) > 0
    GROUP  BY 1
    ORDER  BY 2 DESC
    LIMIT  25
  `);

  if (rows.length === 0) {
    // Attempt 3: modes distribution as final fallback
    const modeRows = await q<{ label: string; count: number }>(`
      SELECT unnest(modes) AS label,
             COUNT(*)::int AS count
      FROM   atlas.knowledge_documents
      WHERE  modes IS NOT NULL
        AND  cardinality(modes) > 0
      GROUP  BY 1
      ORDER  BY 2 DESC
      LIMIT  25
    `);
    return success({
      case: "semantic_clusters",
      renderer: "recharts-bar",
      data_source: "atlas.knowledge_documents.modes[]",
      story:
        modeRows.length > 0
          ? `Transport mode distribution across ${modeRows.length} modes in the knowledge base (cluster proxy).`
          : "No cluster or theme data found yet. Populate atlas.semantic_clusters or the themes/modes columns on knowledge_documents.",
      data: modeRows.map((r) => ({
        label: r.label,
        count: Number(r.count),
      })),
      caveats: [
        "atlas.semantic_clusters table not found.",
        "Using transport mode distribution as proxy. Run the semantic clustering pipeline to populate atlas.semantic_clusters.",
      ],
    });
  }

  return success({
    case: "semantic_clusters",
    renderer: "recharts-bar",
    data_source: "atlas.knowledge_documents.themes[]",
    story: `Top ${rows.length} themes across the approved knowledge base — used as a proxy for semantic clusters.`,
    data: rows.map((r) => ({ label: r.label, count: Number(r.count) })),
    caveats: [
      "atlas.semantic_clusters table not found. Using theme distribution as proxy.",
      "Run the semantic clustering pipeline (scripts/generate-landscape-snapshot.ts) to populate atlas.semantic_clusters.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Case: innovation_map
// Uses viz_x/viz_y columns for scatter plot; falls back to
// transport_relevance_score distribution if those columns don't exist.
// ---------------------------------------------------------------------------

async function innovationMap(): Promise<VisualisationDataResponse> {
  // Discover whether viz_x / viz_y exist
  const vizCols = await q<{ column_name: string }>(`
    SELECT column_name
    FROM   information_schema.columns
    WHERE  table_schema = 'atlas'
      AND  table_name   = 'projects'
      AND  column_name  IN ('viz_x', 'viz_y')
  `);
  const hasViz = vizCols.length === 2;

  if (hasViz) {
    const rows = await q<{ x: number; y: number; item_type: string }>(`
      SELECT viz_x::float  AS x,
             viz_y::float  AS y,
             'project'     AS item_type
      FROM   atlas.projects
      WHERE  viz_x IS NOT NULL
        AND  viz_y IS NOT NULL
      LIMIT  300
    `);
    return success({
      case: "innovation_map",
      renderer: "recharts-scatter",
      data_source: "atlas.projects (viz_x, viz_y)",
      story: `${rows.length} projects positioned in innovation space using pre-computed viz coordinates.`,
      data: rows.map((r) => ({
        x: Number(r.x),
        y: Number(r.y),
        item_type: r.item_type,
      })),
      caveats:
        rows.length < 10
          ? [
              "Fewer than 10 projects have viz_x/viz_y populated. Run the landscape snapshot script.",
            ]
          : [],
    });
  }

  // Fallback: transport_relevance_score as a 1-D distribution (bucketed)
  const rows = await q<{ bucket: string; count: number }>(`
    SELECT CASE
             WHEN transport_relevance_score >= 0.8 THEN '0.8–1.0 (High)'
             WHEN transport_relevance_score >= 0.6 THEN '0.6–0.8 (Good)'
             WHEN transport_relevance_score >= 0.4 THEN '0.4–0.6 (Moderate)'
             WHEN transport_relevance_score >= 0.2 THEN '0.2–0.4 (Low)'
             ELSE                                       '0.0–0.2 (Minimal)'
           END    AS bucket,
           COUNT(*)::int AS count
    FROM   atlas.projects
    WHERE  transport_relevance_score IS NOT NULL
    GROUP  BY 1
    ORDER  BY MIN(transport_relevance_score) DESC
  `);

  return success({
    case: "innovation_map",
    renderer: "recharts-bar",
    data_source: "atlas.projects (transport_relevance_score)",
    story: `Transport relevance distribution across ${rows.reduce((s, r) => s + Number(r.count), 0)} projects. viz_x/viz_y not yet populated — run scripts/generate-landscape-snapshot.ts to build the 2D map.`,
    data: rows.map((r) => ({ label: r.bucket, count: Number(r.count) })),
    caveats: [
      "viz_x and viz_y columns not found in atlas.projects.",
      "Showing transport_relevance_score distribution as a 1D proxy. Run generate-landscape-snapshot to compute UMAP coordinates.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Case: theme_intersections
// Builds VennSet[] data from atlas.knowledge_documents.themes[] (or projects).
// Returns single-set sizes + pairwise intersection counts for up to 3 themes.
// ---------------------------------------------------------------------------

async function themeIntersections(): Promise<VisualisationDataResponse> {
  // Step 1: discover the top-3 themes by document count
  const topThemes = await q<{ theme: string; count: number }>(`
    SELECT unnest(themes) AS theme,
           COUNT(*)::int  AS count
    FROM   atlas.knowledge_documents
    WHERE  themes IS NOT NULL
      AND  cardinality(themes) > 0
    GROUP  BY 1
    ORDER  BY 2 DESC
    LIMIT  3
  `).catch(() => [] as { theme: string; count: number }[]);

  // Fallback: try atlas.projects.themes or modes if knowledge_documents empty
  let themeRows = topThemes;
  if (themeRows.length === 0) {
    themeRows = await q<{ theme: string; count: number }>(`
      SELECT unnest(themes) AS theme,
             COUNT(*)::int  AS count
      FROM   atlas.projects
      WHERE  themes IS NOT NULL
        AND  cardinality(themes) > 0
      GROUP  BY 1
      ORDER  BY 2 DESC
      LIMIT  3
    `).catch(() => [] as { theme: string; count: number }[]);
  }

  // If still empty, return a clearly-labelled empty state
  if (themeRows.length < 2) {
    return success({
      case: "theme_intersections",
      renderer: "venn",
      data_source: "atlas.knowledge_documents.themes[] / atlas.projects.themes[]",
      story: "No theme data found yet. Populate the themes[] column on knowledge_documents or projects to see intersection analysis.",
      data: [],
      caveats: [
        "themes[] column is empty or null across all rows.",
        "Populate themes[] on atlas.knowledge_documents (or atlas.projects) to enable Venn intersection view.",
      ],
    });
  }

  const themes = themeRows.map((r) => r.theme);

  // Step 2: for each top theme, exact document count (single-set size)
  const singles = themeRows.map((r) => ({
    sets: [r.theme],
    size: Number(r.count),
  }));

  // Step 3: pairwise intersections
  const pairs: Array<{ sets: string[]; size: number }> = [];
  for (let i = 0; i < themes.length; i++) {
    for (let j = i + 1; j < themes.length; j++) {
      const rows = await q<{ count: number }>(`
        SELECT COUNT(*)::int AS count
        FROM   atlas.knowledge_documents
        WHERE  $1 = ANY(themes)
          AND  $2 = ANY(themes)
      `, [themes[i], themes[j]]).catch(() => [{ count: 0 }]);
      const pairCount = Number(rows[0]?.count ?? 0);
      if (pairCount > 0) {
        pairs.push({ sets: [themes[i], themes[j]], size: pairCount });
      }
    }
  }

  // Step 4: triple intersection (only if 3 themes found)
  const tripleData: Array<{ sets: string[]; size: number }> = [];
  if (themes.length === 3) {
    const rows = await q<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM   atlas.knowledge_documents
      WHERE  $1 = ANY(themes)
        AND  $2 = ANY(themes)
        AND  $3 = ANY(themes)
    `, [themes[0], themes[1], themes[2]]).catch(() => [{ count: 0 }]);
    const tripleCount = Number(rows[0]?.count ?? 0);
    if (tripleCount > 0) {
      tripleData.push({ sets: [themes[0], themes[1], themes[2]], size: tripleCount });
    }
  }

  const allSets = [...singles, ...pairs, ...tripleData];
  const totalDocs = singles.reduce((s, r) => s + r.size, 0);

  return success({
    case: "theme_intersections",
    renderer: "venn",
    data_source: "atlas.knowledge_documents.themes[]",
    story: `Theme intersection analysis across ${totalDocs} documents. Top themes: ${themes.join(", ")}. Overlap shows projects spanning multiple themes.`,
    data: allSets as Record<string, unknown>[],
    caveats:
      pairs.length === 0
        ? ["No cross-theme documents found. Themes may be mutually exclusive in this corpus."]
        : [],
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const HANDLERS: Record<
  SupportedCase,
  () => Promise<VisualisationDataResponse>
> = {
  project_timeline: projectTimeline,
  live_calls_landscape: liveCallsLandscape,
  knowledge_authority: knowledgeAuthority,
  semantic_clusters: semanticClusters,
  innovation_map: innovationMap,
  theme_intersections: themeIntersections,
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const caseParam = req.nextUrl.searchParams.get(
    "case",
  ) as SupportedCase | null;

  if (!caseParam) {
    return NextResponse.json(
      {
        error: "Missing ?case= parameter",
        supported: SUPPORTED_CASES,
      },
      { status: 400 },
    );
  }

  if (!(SUPPORTED_CASES as readonly string[]).includes(caseParam)) {
    return NextResponse.json(
      {
        error: `Unknown case '${caseParam}'`,
        supported: SUPPORTED_CASES,
      },
      { status: 400 },
    );
  }

  try {
    const result = await HANDLERS[caseParam]();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(`[visualisation-data] case=${caseParam} error:`, err);
    const detail =
      process.env.NODE_ENV === "development" ? String(err) : undefined;
    return NextResponse.json(
      {
        ok: false,
        case: caseParam,
        error: "Query failed",
        ...(detail ? { detail } : {}),
      },
      { status: 500 },
    );
  }
}
