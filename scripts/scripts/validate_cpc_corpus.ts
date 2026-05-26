#!/usr/bin/env tsx
/**
 * CPC Capability Corpus v0.1 — Validation script
 *
 * Runs file-level, schema, post-ingestion count, governance, and query
 * behaviour checks. Writes a report to scripts/output/.
 *
 * Usage:
 *   pnpm tsx scripts/validate_cpc_corpus.ts [--pack-dir PATH] [--skip-api]
 *
 * Options:
 *   --pack-dir PATH   Root of the ingestion pack (default: auto-discovered)
 *   --skip-api        Skip health endpoint validation
 */
import "load-env";

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Minimal CSV parser (handles quoted fields with embedded commas/newlines) ──

function parseCsv(content: string): Record<string, string>[] {
  const lines: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if (ch === "\n" && !inQuote) {
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  // Strip carriage returns from Windows-style CRLF line endings
  const nonEmpty = lines.map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");
  if (nonEmpty.length < 2) return [];

  const headers = splitCsvLine(nonEmpty[0]);
  return nonEmpty.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] ?? "";
    }
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(current.replace(/^"|"$/g, "").replace(/""/g, '"'));
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.replace(/^"|"$/g, "").replace(/""/g, '"'));
  return result;
}

// ── Config ──────────────────────────────────────────────────────────────────

const CORPUS_TAG = "cpc_v0_1";
const EXPECTED_PROJECTS = 392;
const EXPECTED_CAPABILITY_PROFILES = 1;
// IMP023 in impact_claim_candidates_v0.csv is claim_level=3 and excluded by governance.
const EXPECTED_IMPACT_CLAIMS = 31;
const EXPECTED_EVAL_CLAIMS = 12;
const EXPECTED_PMO_CLAIMS = 5;
const EXPECTED_TOTAL_CLAIMS = EXPECTED_IMPACT_CLAIMS + EXPECTED_EVAL_CLAIMS + EXPECTED_PMO_CLAIMS; // 48
const EXPECTED_EVIDENCE_LINKS = 48;

const OUTPUT_DIR = path.join(__dirname, "output");

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const packDirIdx = args.indexOf("--pack-dir");
const packDirArg: string | null = packDirIdx !== -1 ? (args[packDirIdx + 1] ?? null) : null;
const skipApi = args.includes("--skip-api");

// ── DB pool ──────────────────────────────────────────────────────────────────

function makePool(): Pool {
  const raw = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  if (!raw) {
    fail("DATABASE_URL or POSTGRES_URL environment variable not set.");
  }
  const url = raw.replace(/[?&]sslmode=[^&]*/g, "");
  return new Pool({
    connectionString: url,
    ssl: !url.includes("localhost") ? { rejectUnauthorized: false } : false,
    max: 3,
  });
}

// ── Result tracking ──────────────────────────────────────────────────────────

type CheckStatus = "pass" | "fail" | "warn" | "skip";

interface CheckResult {
  section: string;
  name: string;
  status: CheckStatus;
  detail?: string;
}

const results: CheckResult[] = [];
const warnings: string[] = [];

function record(section: string, name: string, status: CheckStatus, detail?: string) {
  results.push({ section, name, status, detail });
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : status === "warn" ? "⚠" : "–";
  console.log(`  [${section}] ${icon} ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(msg: string): never {
  console.error(`\nFATAL: ${msg}`);
  process.exit(1);
}

// ── Pack discovery ────────────────────────────────────────────────────────────

function findPackDir(): string {
  if (packDirArg) {
    if (!fs.existsSync(packDirArg)) fail(`--pack-dir does not exist: ${packDirArg}`);
    return packDirArg;
  }
  const candidates = [
    path.join(__dirname, "..", "atlas_cpc_corpus_ingestion_pack_v0_1"),
    path.join(process.env.USERPROFILE ?? process.env.HOME ?? "", "Downloads", "atlas_cpc_corpus_ingestion_pack_v0_1", "atlas_cpc_corpus_ingestion_pack_v0_1"),
    path.join(process.env.USERPROFILE ?? process.env.HOME ?? "", "Downloads", "atlas_cpc_corpus_ingestion_pack_v0_1"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "data"))) return c;
  }
  fail("Cannot locate ingestion pack. Supply --pack-dir PATH.");
}

// ── File validation helpers ───────────────────────────────────────────────────

interface FileSpec {
  relPath: string;
  minRows: number;
  requiredCols: string[];
}

const FILE_SPECS: FileSpec[] = [
  {
    relPath: "data/projects_master_v0_4_targeted_enriched.csv",
    minRows: 392,
    requiredCols: [
      "project_code", "project_name", "business_unit", "customer_or_funder",
      "delivery_status", "delivery_status_normalised", "project_budget_gbp",
      "start_date", "end_date", "mode_or_focus_area", "cpc_role",
      "brief_description", "dynamics_365_url", "source_files", "source_confidence",
    ],
  },
  {
    relPath: "data/impact_claim_candidates_v0.csv",
    minRows: 32,
    requiredCols: [
      "claim_id", "entity_type", "entity_id_or_project_code", "claim_level",
      "claim_domain", "claim_text", "confidence_tier", "confidence_reason",
      "source_file", "source_excerpt",
    ],
  },
  {
    relPath: "data/evaluation_method_claims_v0.csv",
    minRows: 12,
    requiredCols: [
      "method_claim_id", "claim_text", "source_file", "source_excerpt",
      "applies_to", "confidence_tier", "notes",
    ],
  },
  {
    relPath: "data/claim_candidates_v0_7_validated_pmo_subset.csv",
    minRows: 5,
    requiredCols: [
      "claim_id", "project_code", "entity_type", "claim_level", "claim_subtype",
      "claim_domain", "claim_text", "confidence_tier", "confidence_reason",
      "source_file", "source_excerpt", "review_status",
    ],
  },
  {
    relPath: "data/claim_evidence_links_v0_7_validated_pmo_subset.csv",
    minRows: 5,
    requiredCols: [
      "link_id", "claim_id", "source_file", "source_excerpt",
      "evidence_type", "evidence_quality", "source_confidence", "notes",
    ],
  },
];

// ── SQL helpers ───────────────────────────────────────────────────────────────

async function queryRows<T = Record<string, unknown>>(pool: Pool, sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query<T>(sql, params);
  return res.rows;
}

async function queryOne<T = Record<string, unknown>>(pool: Pool, sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await queryRows<T>(pool, sql, params);
  return rows[0] ?? null;
}

async function count(pool: Pool, sql: string, params: unknown[] = []): Promise<number> {
  const row = await queryOne<{ cnt: string }>(pool, sql, params);
  return Number(row?.cnt ?? 0);
}

// ── A. File validation ────────────────────────────────────────────────────────

function validateFiles(packDir: string): void {
  console.log("\n── A. File validation ──────────────────────────────────────────");
  let allPass = true;

  for (const spec of FILE_SPECS) {
    const fullPath = path.join(packDir, spec.relPath);

    if (!fs.existsSync(fullPath)) {
      record("files", spec.relPath, "fail", "File not found");
      allPass = false;
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    let rows: Record<string, string>[];
    try {
      rows = parseCsv(content);
    } catch (err) {
      record("files", spec.relPath, "fail", `CSV parse error: ${err}`);
      allPass = false;
      continue;
    }

    const rowCount = rows.length;
    if (rowCount < spec.minRows) {
      record("files", spec.relPath, "fail", `${rowCount} rows, expected >= ${spec.minRows}`);
      allPass = false;
    } else {
      record("files", spec.relPath, "pass", `${rowCount} rows`);
    }

    if (rows.length > 0) {
      const actualCols = new Set(Object.keys(rows[0]));
      const missing = spec.requiredCols.filter((c) => !actualCols.has(c));
      if (missing.length > 0) {
        record("files", `${path.basename(spec.relPath)} columns`, "fail", `Missing: ${missing.join(", ")}`);
        allPass = false;
      } else {
        record("files", `${path.basename(spec.relPath)} columns`, "pass", `All ${spec.requiredCols.length} required columns present`);
      }
    }
  }

  if (!allPass) fail("File validation failed. Fix the above errors before ingesting.");
}

// ── B. Schema validation ──────────────────────────────────────────────────────

async function validateSchema(pool: Pool): Promise<void> {
  console.log("\n── B. Schema validation ─────────────────────────────────────────");

  const tables: Array<[string, string]> = [
    ["atlas", "evidence_containers"],
    ["atlas", "claims"],
    ["atlas", "profile_claims"],
    ["atlas", "claim_evidence_links"],
  ];

  for (const [schema, table] of tables) {
    const row = await queryOne(pool,
      `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
      [schema, table],
    );
    if (!row) {
      record("schema", `${schema}.${table}`, "fail", "Table does not exist — run migration first");
    } else {
      record("schema", `${schema}.${table}`, "pass", "Table exists");
    }
  }

  // Validate required columns
  type ColSpec = { schema: string; table: string; cols: string[] };
  const colSpecs: ColSpec[] = [
    {
      schema: "atlas", table: "evidence_containers",
      cols: ["external_id", "corpus_tag", "parent_profile_id", "business_unit",
             "customer_or_funder", "delivery_status", "delivery_status_normalised",
             "budget_gbp", "dynamics_url", "cpc_role", "source_confidence", "metadata"],
    },
    {
      schema: "atlas", table: "claims",
      cols: ["corpus_tag", "claim_subtype", "confidence_reason", "source_label",
             "source_excerpt", "entity_type", "entity_id", "review_status",
             "freshness_status", "metadata"],
    },
    { schema: "atlas", table: "profile_claims", cols: ["container_id", "claim_id"] },
    {
      schema: "atlas", table: "claim_evidence_links",
      cols: ["claim_id", "external_claim_id", "source_file", "source_excerpt",
             "evidence_type", "evidence_quality", "source_confidence"],
    },
  ];

  for (const spec of colSpecs) {
    const rows = await queryRows<{ column_name: string }>(pool,
      `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
      [spec.schema, spec.table],
    );
    const actual = new Set(rows.map((r) => r.column_name));
    const missing = spec.cols.filter((c) => !actual.has(c));
    if (missing.length > 0) {
      record("schema", `${spec.schema}.${spec.table} columns`, "fail", `Missing: ${missing.join(", ")}`);
    } else {
      record("schema", `${spec.schema}.${spec.table} columns`, "pass", `All required columns present`);
    }
  }
}

// ── C. Post-ingestion count validation ───────────────────────────────────────

async function validateCounts(pool: Pool): Promise<void> {
  console.log("\n── C. Post-ingestion counts ─────────────────────────────────────");

  // Capability profile
  const capCount = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.evidence_containers WHERE corpus_tag=$1 AND container_type='capability_profile'`,
    [CORPUS_TAG],
  );
  record("counts", "CPC Capability Profile", capCount === 1 ? "pass" : "fail",
    `${capCount} (expected 1)`);

  // Project containers
  const projCount = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.evidence_containers
     WHERE corpus_tag=$1 AND container_type IN ('project_evidence_profile','project_evidence')`,
    [CORPUS_TAG],
  );
  record("counts", "Project containers", projCount === EXPECTED_PROJECTS ? "pass" : "fail",
    `${projCount} (expected ${EXPECTED_PROJECTS})`);

  // Total claims
  const claimCount = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claims WHERE corpus_tag=$1`,
    [CORPUS_TAG],
  );
  record("counts", "Total claims", claimCount === EXPECTED_TOTAL_CLAIMS ? "pass" : "fail",
    `${claimCount} (expected ${EXPECTED_TOTAL_CLAIMS})`);

  // By claim subtype
  const impactCount = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claims WHERE corpus_tag=$1 AND metadata->>'source_file'='impact_claim_candidates_v0.csv'`,
    [CORPUS_TAG],
  );
  record("counts", "Impact claims", impactCount === EXPECTED_IMPACT_CLAIMS ? "pass" : (impactCount > 0 ? "warn" : "fail"),
    `${impactCount} (expected ${EXPECTED_IMPACT_CLAIMS})`);

  const evalCount = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claims WHERE corpus_tag=$1 AND metadata->>'source_file'='evaluation_method_claims_v0.csv'`,
    [CORPUS_TAG],
  );
  record("counts", "Eval method claims", evalCount === EXPECTED_EVAL_CLAIMS ? "pass" : (evalCount > 0 ? "warn" : "fail"),
    `${evalCount} (expected ${EXPECTED_EVAL_CLAIMS})`);

  const pmoCount = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claims WHERE corpus_tag=$1 AND metadata->>'source_file'='claim_candidates_v0_7_validated_pmo_subset.csv'`,
    [CORPUS_TAG],
  );
  record("counts", "PMO validated claims", pmoCount === EXPECTED_PMO_CLAIMS ? "pass" : (pmoCount > 0 ? "warn" : "fail"),
    `${pmoCount} (expected ${EXPECTED_PMO_CLAIMS})`);

  // Evidence links
  const linkCount = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claim_evidence_links el JOIN atlas.claims c ON c.id=el.claim_id WHERE c.corpus_tag=$1`,
    [CORPUS_TAG],
  );
  record("counts", "Evidence links", linkCount >= EXPECTED_EVIDENCE_LINKS ? "pass" : "fail",
    `${linkCount} (expected >= ${EXPECTED_EVIDENCE_LINKS})`);

  // All project containers have parent_profile_id
  const missingParent = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.evidence_containers
     WHERE corpus_tag=$1 AND container_type IN ('project_evidence_profile','project_evidence')
     AND parent_profile_id IS NULL`,
    [CORPUS_TAG],
  );
  record("counts", "Projects with parent_profile_id", missingParent === 0 ? "pass" : "fail",
    missingParent === 0 ? "All 392 linked" : `${missingParent} containers missing parent_profile_id`);

  // profile_claims not used for container→container links
  const containerToContainer = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.profile_claims pc
     JOIN atlas.evidence_containers c ON c.id = pc.claim_id`,
  );
  record("counts", "No container→container profile_claims", containerToContainer === 0 ? "pass" : "fail",
    containerToContainer === 0 ? "Clean" : `${containerToContainer} invalid profile_claim rows found`);
}

// ── D. Governance validation ─────────────────────────────────────────────────

async function validateGovernance(pool: Pool): Promise<void> {
  console.log("\n── D. Governance checks ─────────────────────────────────────────");

  // No Level 3 claims
  const level3Count = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claims WHERE corpus_tag=$1 AND claim_level=3`,
    [CORPUS_TAG],
  );
  record("governance", "No Level 3 claims", level3Count === 0 ? "pass" : "fail",
    level3Count === 0 ? "0 Level 3 claims" : `VIOLATION: ${level3Count} Level 3 claims found`);

  // verified_internal not promoted to verified
  const badPromotion = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claims
     WHERE corpus_tag=$1
       AND confidence_tier='verified'
       AND metadata->>'original_confidence_tier'='verified_internal'`,
    [CORPUS_TAG],
  );
  record("governance", "verified_internal not promoted", badPromotion === 0 ? "pass" : "fail",
    badPromotion === 0 ? "No improper promotions" : `VIOLATION: ${badPromotion} claims improperly promoted`);

  // No claims from project metadata fields
  const metadataSourced = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claims
     WHERE corpus_tag=$1
       AND (metadata->>'ingest_source' ILIKE '%project%'
            OR metadata->'project_metadata_only' = 'true'::jsonb)`,
    [CORPUS_TAG],
  );
  record("governance", "No claims from project metadata", metadataSourced === 0 ? "pass" : "fail",
    metadataSourced === 0 ? "None" : `VIOLATION: ${metadataSourced} potential metadata-sourced claims`);

  // No rejected PMO text fragments used as outcome evidence
  const rejectedFragments = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claims
     WHERE corpus_tag=$1
       AND (claim_text ILIKE '%Figure 1 displays%'
            OR claim_text ILIKE '%slippage in days%'
            OR claim_text ILIKE '%risk log%')`,
    [CORPUS_TAG],
  );
  record("governance", "No rejected PMO fragments", rejectedFragments === 0 ? "pass" : "fail",
    rejectedFragments === 0 ? "None" : `VIOLATION: ${rejectedFragments} claims with rejected PMO text`);

  // All claims have review_status = pending
  const notPending = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claims
     WHERE corpus_tag=$1 AND review_status != 'pending'`,
    [CORPUS_TAG],
  );
  record("governance", "All claims pending review", notPending === 0 ? "pass" : "warn",
    notPending === 0 ? "All pending" : `${notPending} claims not in pending status`);
}

// ── E. Query behaviour ────────────────────────────────────────────────────────

async function validateQueryBehaviour(pool: Pool): Promise<void> {
  console.log("\n── E. Query behaviour ───────────────────────────────────────────");

  // 1. Business unit breakdown
  const buRows = await queryRows<{ business_unit: string | null; cnt: string }>(pool,
    `SELECT COALESCE(business_unit,'not_found_or_null') AS business_unit, COUNT(*)::text AS cnt
     FROM atlas.evidence_containers WHERE corpus_tag=$1 AND container_type IN ('project_evidence_profile','project_evidence')
     GROUP BY business_unit ORDER BY COUNT(*) DESC`,
    [CORPUS_TAG],
  );
  console.log("    Business units:", buRows.map((r) => `${r.business_unit}=${r.cnt}`).join(", "));
  record("queries", "Business unit breakdown", buRows.length > 0 ? "pass" : "warn",
    `${buRows.length} distinct units`);

  // 2. Top 10 customer/funder
  const funderRows = await queryRows<{ customer_or_funder: string | null; cnt: string }>(pool,
    `SELECT customer_or_funder, COUNT(*)::text AS cnt FROM atlas.evidence_containers
     WHERE corpus_tag=$1 AND container_type IN ('project_evidence_profile','project_evidence')
     GROUP BY customer_or_funder ORDER BY COUNT(*) DESC LIMIT 10`,
    [CORPUS_TAG],
  );
  console.log("    Top funders:", funderRows.map((r) => `${r.customer_or_funder}=${r.cnt}`).join(", "));
  record("queries", "Top funders", funderRows.length > 0 ? "pass" : "warn", `${funderRows.length} returned`);

  // 3. Claims by confidence tier
  const confRows = await queryRows<{ confidence_tier: string | null; cnt: string }>(pool,
    `SELECT confidence_tier, COUNT(*)::text AS cnt FROM atlas.claims WHERE corpus_tag=$1 GROUP BY confidence_tier`,
    [CORPUS_TAG],
  );
  console.log("    Claims by confidence:", confRows.map((r) => `${r.confidence_tier}=${r.cnt}`).join(", "));
  record("queries", "Claims by confidence", confRows.length > 0 ? "pass" : "warn", `${confRows.length} tiers`);

  // 4. Claims by level
  const levelRows = await queryRows<{ claim_level: number; cnt: string }>(pool,
    `SELECT claim_level, COUNT(*)::text AS cnt FROM atlas.claims WHERE corpus_tag=$1 GROUP BY claim_level ORDER BY claim_level`,
    [CORPUS_TAG],
  );
  console.log("    Claims by level:", levelRows.map((r) => `L${r.claim_level}=${r.cnt}`).join(", "));
  record("queries", "Claims by level", levelRows.length > 0 ? "pass" : "warn", `${levelRows.length} levels`);

  // 5. Claims by subtype
  const subtypeRows = await queryRows<{ claim_subtype: string | null; cnt: string }>(pool,
    `SELECT COALESCE(claim_subtype,'null') AS claim_subtype, COUNT(*)::text AS cnt
     FROM atlas.claims WHERE corpus_tag=$1 GROUP BY claim_subtype ORDER BY COUNT(*) DESC`,
    [CORPUS_TAG],
  );
  record("queries", "Claims by subtype", "pass", `${subtypeRows.length} subtypes`);

  // 6. Evidence links with source_excerpt
  const linkWithExcerpt = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.claim_evidence_links el
     JOIN atlas.claims c ON c.id=el.claim_id WHERE c.corpus_tag=$1 AND el.source_excerpt IS NOT NULL`,
    [CORPUS_TAG],
  );
  record("queries", "Evidence links with excerpt", "pass", `${linkWithExcerpt}`);

  // 7. DfT project count
  const dftCount = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.evidence_containers
     WHERE corpus_tag=$1 AND customer_or_funder ILIKE '%department for transport%'`,
    [CORPUS_TAG],
  );
  record("queries", "DfT projects", "pass", `${dftCount}`);

  // 8. Network Rail project count
  const nrCount = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM atlas.evidence_containers
     WHERE corpus_tag=$1 AND customer_or_funder ILIKE '%network rail%'`,
    [CORPUS_TAG],
  );
  record("queries", "Network Rail projects", "pass", `${nrCount}`);

  // 9. PMO claims linked to project containers
  const pmoLinked = await count(pool,
    `SELECT COUNT(DISTINCT c.id)::text AS cnt
     FROM atlas.claims c
     JOIN atlas.profile_claims pc ON pc.claim_id=c.id
     JOIN atlas.evidence_containers ec ON ec.id=pc.container_id
     WHERE c.corpus_tag=$1
       AND ec.container_type IN ('project_evidence_profile','project_evidence')
       AND c.metadata->>'source_file'='claim_candidates_v0_7_validated_pmo_subset.csv'`,
    [CORPUS_TAG],
  );
  record("queries", "PMO claims linked to project containers",
    pmoLinked > 0 ? "pass" : "warn", `${pmoLinked} PMO claims with project links`);

  // 10. Capability Profile claims via profile_claims
  const capLinked = await count(pool,
    `SELECT COUNT(*)::text AS cnt
     FROM atlas.profile_claims pc
     JOIN atlas.evidence_containers ec ON ec.id=pc.container_id
     WHERE ec.corpus_tag=$1 AND ec.container_type='capability_profile'`,
    [CORPUS_TAG],
  );
  record("queries", "Claims linked to Capability Profile", capLinked > 0 ? "pass" : "warn",
    `${capLinked} claims linked`);
}

// ── F. API health validation ──────────────────────────────────────────────────

async function validateApiHealth(): Promise<void> {
  console.log("\n── F. API health endpoint ───────────────────────────────────────");

  if (skipApi) {
    record("api", "health endpoint", "skip", "--skip-api flag set");
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/api/atlas/cpc-corpus/health`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      record("api", "health endpoint HTTP", "fail", `HTTP ${res.status}`);
      return;
    }
    const json = await res.json();

    if (!json.corpus_version) {
      record("api", "health endpoint response", "fail", "Missing corpus_version field");
      return;
    }

    const requiredFields = [
      "corpus_version", "project_containers", "capability_profile_container",
      "by_business_unit", "claims", "evidence_links", "embeddings_generated", "warnings",
    ];
    const missing = requiredFields.filter((f) => !(f in json));
    if (missing.length > 0) {
      record("api", "health endpoint fields", "fail", `Missing: ${missing.join(", ")}`);
    } else {
      record("api", "health endpoint", "pass",
        `corpus_version=${json.corpus_version} projects=${json.project_containers} claims=${json.claims?.total}`);
    }
  } catch (err) {
    record("api", "health endpoint", "warn",
      `Could not reach ${url} — start the Next.js dev server to test: ${err}`);
  }
}

// ── G. Idempotency check ──────────────────────────────────────────────────────

async function validateIdempotency(pool: Pool): Promise<void> {
  console.log("\n── G. Idempotency checks ────────────────────────────────────────");

  // Check unique constraint exists on evidence_containers(external_id)
  const ecUniqueIdx = await queryOne(pool,
    `SELECT 1 FROM pg_indexes
     WHERE schemaname='atlas' AND tablename='evidence_containers'
     AND indexdef ILIKE '%external_id%'`,
  );
  record("idempotency", "evidence_containers unique by external_id",
    ecUniqueIdx ? "pass" : "warn",
    ecUniqueIdx ? "Index found" : "No external_id index — upserts may duplicate on re-run");

  // Check profile_claims unique constraint
  const pcUniqueIdx = await queryOne(pool,
    `SELECT 1 FROM pg_indexes
     WHERE schemaname='atlas' AND tablename='profile_claims'
     AND indexdef ILIKE '%unique%' OR indexname ILIKE '%unique%'`,
  );

  // Actually check the constraint directly
  const pcConstraint = await queryOne(pool,
    `SELECT 1 FROM pg_constraint c
     JOIN pg_class t ON t.oid=c.conrelid
     JOIN pg_namespace n ON n.oid=t.relnamespace
     WHERE n.nspname='atlas' AND t.relname='profile_claims' AND c.contype='u'`,
  );
  record("idempotency", "profile_claims unique(container_id, claim_id)",
    pcConstraint ? "pass" : "warn",
    pcConstraint ? "Unique constraint found" : "No unique constraint — profile_claims may duplicate");

  // Check for duplicate claims by external_claim_id
  const dupClaims = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM (
       SELECT metadata->>'external_claim_id' AS eid, COUNT(*) AS n
       FROM atlas.claims WHERE corpus_tag=$1 AND metadata->>'external_claim_id' IS NOT NULL
       GROUP BY eid HAVING COUNT(*) > 1
     ) t`,
    [CORPUS_TAG],
  );
  record("idempotency", "No duplicate claims by external_claim_id",
    dupClaims === 0 ? "pass" : "fail",
    dupClaims === 0 ? "None" : `${dupClaims} duplicated external claim IDs`);

  // Check for duplicate project containers by external_id
  const dupContainers = await count(pool,
    `SELECT COUNT(*)::text AS cnt FROM (
       SELECT external_id, COUNT(*) AS n
       FROM atlas.evidence_containers WHERE corpus_tag=$1 AND external_id IS NOT NULL
       GROUP BY external_id HAVING COUNT(*) > 1
     ) t`,
    [CORPUS_TAG],
  );
  record("idempotency", "No duplicate project containers by external_id",
    dupContainers === 0 ? "pass" : "fail",
    dupContainers === 0 ? "None" : `${dupContainers} duplicated external_ids`);
}

// ── H. Report output ──────────────────────────────────────────────────────────

function buildReport(): { json: object; md: string } {
  const bySection: Record<string, CheckResult[]> = {};
  for (const r of results) {
    if (!bySection[r.section]) bySection[r.section] = [];
    bySection[r.section].push(r);
  }

  const sectionSummary: Record<string, "pass" | "fail" | "warn" | "skip"> = {};
  for (const [sec, checks] of Object.entries(bySection)) {
    if (checks.some((c) => c.status === "fail")) sectionSummary[sec] = "fail";
    else if (checks.some((c) => c.status === "warn")) sectionSummary[sec] = "warn";
    else if (checks.every((c) => c.status === "skip")) sectionSummary[sec] = "skip";
    else sectionSummary[sec] = "pass";
  }

  const overallPass = Object.values(sectionSummary).every((s) => s === "pass" || s === "skip");

  // JSON report
  const jsonReport = {
    generated_at: new Date().toISOString(),
    corpus_tag: CORPUS_TAG,
    overall: overallPass ? "pass" : "fail",
    sections: sectionSummary,
    checks: results,
    warnings,
  };

  // Markdown report
  const icon = (s: CheckStatus) => (s === "pass" ? "✅" : s === "fail" ? "❌" : s === "warn" ? "⚠️" : "–");
  let md = `# CPC Corpus Validation Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `**Overall: ${overallPass ? "✅ PASS" : "❌ FAIL"}**\n\n`;
  md += `## Section Summary\n\n`;
  for (const [sec, status] of Object.entries(sectionSummary)) {
    md += `- ${icon(status)} **${sec}**: ${status}\n`;
  }
  md += `\n## Detail\n\n`;
  for (const [sec, checks] of Object.entries(bySection)) {
    md += `### ${sec}\n\n`;
    for (const c of checks) {
      md += `- ${icon(c.status)} ${c.name}${c.detail ? ` — ${c.detail}` : ""}\n`;
    }
    md += "\n";
  }
  if (warnings.length > 0) {
    md += `## Warnings\n\n`;
    for (const w of warnings) md += `- ${w}\n`;
    md += "\n";
  }
  md += `## Next Recommended Fixes\n\n`;
  const fails = results.filter((r) => r.status === "fail");
  if (fails.length === 0) {
    md += "No failures — ingestion is complete.\n";
  } else {
    for (const f of fails) {
      md += `- Fix [${f.section}] ${f.name}: ${f.detail ?? ""}\n`;
    }
  }

  return { json: jsonReport, md };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log("CPC Capability Corpus v0.1 — Validation");
  console.log("══════════════════════════════════════════════════════════════");

  const packDir = findPackDir();
  console.log(`Pack dir: ${packDir}`);

  // A. File validation (no DB needed)
  validateFiles(packDir);

  // Connect to DB for remaining checks
  const pool = makePool();

  try {
    await pool.query("SELECT 1");
    console.log("  [db] Connected.");
  } catch (err) {
    fail(`Cannot connect to database: ${err}`);
  }

  try {
    // B. Schema
    await validateSchema(pool);

    // C. Counts
    await validateCounts(pool);

    // D. Governance
    await validateGovernance(pool);

    // E. Query behaviour
    await validateQueryBehaviour(pool);

    // F. API health
    await validateApiHealth();

    // G. Idempotency
    await validateIdempotency(pool);
  } finally {
    await pool.end();
  }

  // H. Report
  console.log("\n── H. Report output ─────────────────────────────────────────────");
  const { json: jsonReport, md: mdReport } = buildReport();

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const jsonPath = path.join(OUTPUT_DIR, "cpc_corpus_validation_report.json");
  const mdPath = path.join(OUTPUT_DIR, "cpc_corpus_validation_report.md");

  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), "utf-8");
  fs.writeFileSync(mdPath, mdReport, "utf-8");

  console.log(`  Report written to:\n    ${jsonPath}\n    ${mdPath}`);

  // Print final summary
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("CPC Corpus Validation Report");
  const sectionMap: Record<string, string> = {
    files: "A. file checks",
    schema: "B. schema checks",
    counts: "C. ingestion counts",
    governance: "D. governance checks",
    api: "E. health endpoint",
    idempotency: "F. idempotency",
  };

  const bySection: Record<string, CheckResult[]> = {};
  for (const r of results) {
    if (!bySection[r.section]) bySection[r.section] = [];
    bySection[r.section].push(r);
  }

  for (const [key, label] of Object.entries(sectionMap)) {
    const checks = bySection[key] ?? [];
    const hasFail = checks.some((c) => c.status === "fail");
    const hasWarn = checks.some((c) => c.status === "warn");
    const status = hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS";
    console.log(`  ${label}: ${status}`);
  }

  const totalFails = results.filter((r) => r.status === "fail").length;
  const totalWarns = results.filter((r) => r.status === "warn").length;
  console.log(`\n  Total: ${totalFails} failures, ${totalWarns} warnings`);
  if (totalFails > 0) {
    console.log("  ❌ Validation FAILED");
  } else {
    console.log("  ✅ Validation PASSED");
  }
  console.log("══════════════════════════════════════════════════════════════\n");

  if (totalFails > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
