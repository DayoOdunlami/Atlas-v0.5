/**
 * GET /api/atlas5/cpc-intelligence
 *
 * Queries the live CPC Capability Corpus v0.1 from Supabase and returns
 * data shaped for the four CPC recipe components:
 *   - cpc_capability_assessment
 *   - cpc_portfolio_comparison
 *   - cpc_market_alignment
 *   - cpc_evidence_gaps
 *
 * Query params:
 *   ?business_unit=Future+Mobility   (optional filter)
 *   ?query=autonomous+freight        (optional keyword filter on container name/description)
 *
 * SECURITY: server-only. Reads POSTGRES_URL. Never exposes SUPABASE_SERVICE_KEY.
 * READ ONLY — SELECT queries only. Never INSERT/UPDATE/DELETE on atlas.*.
 */
import "server-only";

import { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";

import { mapDbTierToDisplay, clampClaimLevel, aggregateTiers } from "@/lib/atlas5/tier-mapping";
import type { ConfidenceTier, CpcClaim, CpcBusinessUnit, CpcGap } from "@/lib/atlas5/types";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// DB pool
// ---------------------------------------------------------------------------

function makePool(): Pool {
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
function pool(): Pool {
  if (!_pool) _pool = makePool();
  return _pool;
}

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface ContainerRow {
  id: string;
  name: string;
  container_type: string;
  business_unit: string | null;
  description: string | null;
  corpus_tag: string;
  source_confidence: string | null;
  delivery_status: string | null;
  mode_or_focus_area: string | null;
  cpc_role: string | null;
  budget_gbp: number | null;
}

interface ClaimRow {
  id: string;
  claim_text: string;
  claim_level: number | null;
  confidence_tier: string | null;
  source_label: string | null;
  source_excerpt: string | null;
  entity_id: string | null;
  claim_domain: string | null;
  evidence_link_count: number;
}

interface EvidenceLinkCountRow {
  claim_id: string;
  cnt: number;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const businessUnit = searchParams.get("business_unit") ?? null;
  const query = searchParams.get("query") ?? null;

  try {
    // 1. Fetch containers (project-level records)
    const containerParams: (string | number)[] = ["cpc_v0_1"];
    let containerWhere = "WHERE corpus_tag = $1 AND is_active = true";
    if (businessUnit) {
      containerParams.push(`%${businessUnit}%`);
      containerWhere += ` AND business_unit ILIKE $${containerParams.length}`;
    }
    if (query) {
      containerParams.push(`%${query}%`);
      containerWhere += ` AND (name ILIKE $${containerParams.length} OR description ILIKE $${containerParams.length})`;
    }

    const { rows: containerRows } = await pool().query<ContainerRow>(
      `SELECT id, name, container_type, business_unit, description,
              corpus_tag, source_confidence, delivery_status,
              mode_or_focus_area, cpc_role, budget_gbp
       FROM   atlas.evidence_containers
       ${containerWhere}
       ORDER  BY business_unit NULLS LAST, name
       LIMIT  200`,
      containerParams,
    );

    // 2. Fetch claims with evidence link counts
    const claimParams: (string | number)[] = ["cpc_v0_1"];
    let claimWhere = "WHERE c.corpus_tag = $1";
    if (businessUnit) {
      // filter claims whose entity_id matches a container in the right BU
      claimParams.push(`%${businessUnit}%`);
      claimWhere += ` AND EXISTS (
        SELECT 1 FROM atlas.evidence_containers ec
        WHERE ec.id::text = c.entity_id
          AND ec.business_unit ILIKE $${claimParams.length}
      )`;
    }

    const { rows: claimRows } = await pool().query<ClaimRow>(
      `SELECT c.id, c.claim_text, c.claim_level, c.confidence_tier,
              c.source_label, c.source_excerpt, c.entity_id, c.claim_domain,
              COALESCE(link_counts.cnt, 0)::int AS evidence_link_count
       FROM   atlas.claims c
       LEFT JOIN (
         SELECT claim_id, COUNT(*)::int AS cnt
         FROM   atlas.claim_evidence_links
         GROUP  BY claim_id
       ) link_counts ON link_counts.claim_id = c.id
       ${claimWhere}
       ORDER  BY c.claim_level DESC, c.confidence_tier
       LIMIT  500`,
      claimParams,
    );

    // 3. Build lookup: container_id → business_unit
    const containerBuMap = new Map<string, string>(
      containerRows.map((r) => [r.id, r.business_unit ?? "Unknown"]),
    );

    // 4. Shape claims → CpcClaim[]
    const cpcClaims: CpcClaim[] = claimRows.map((r) => {
      const displayTier = mapDbTierToDisplay(r.confidence_tier, r.evidence_link_count);
      const businessUnitName = r.entity_id ? (containerBuMap.get(r.entity_id) ?? undefined) : undefined;
      const sourceProject = r.entity_id
        ? containerRows.find((c) => c.id === r.entity_id)?.name
        : undefined;

      return {
        id: r.id,
        text: r.claim_text,
        level: clampClaimLevel(r.claim_level),
        confidence_tier: displayTier,
        source_project: sourceProject ?? r.source_label ?? undefined,
        source_excerpt: r.source_excerpt ?? undefined,
        business_unit: businessUnitName,
      };
    });

    // 5. Build portfolio aggregation by business unit
    const buMap = new Map<string, CpcBusinessUnit>();

    for (const container of containerRows) {
      const bu = container.business_unit ?? "Unknown";
      if (!buMap.has(bu)) {
        buMap.set(bu, {
          name: bu,
          project_count: 0,
          claim_count: 0,
          l1_claims: 0,
          l2_claims: 0,
          l3_claims: 0,
          evidence_links: 0,
        });
      }
      buMap.get(bu)!.project_count += 1;
    }

    for (const claim of cpcClaims) {
      const bu = claim.business_unit ?? "Unknown";
      if (!buMap.has(bu)) {
        buMap.set(bu, {
          name: bu,
          project_count: 0,
          claim_count: 0,
          l1_claims: 0,
          l2_claims: 0,
          l3_claims: 0,
          evidence_links: 0,
        });
      }
      const buEntry = buMap.get(bu)!;
      buEntry.claim_count += 1;
      if (claim.level === 1) buEntry.l1_claims += 1;
      if (claim.level === 2) buEntry.l2_claims += 1;
      if (claim.level === 3) buEntry.l3_claims += 1;
    }

    // Add evidence link counts per BU
    for (const claimRow of claimRows) {
      const containerId = claimRow.entity_id ?? "";
      const bu = containerBuMap.get(containerId) ?? "Unknown";
      const buEntry = buMap.get(bu);
      if (buEntry) buEntry.evidence_links += claimRow.evidence_link_count;
    }

    const portfolio = Array.from(buMap.values()).sort(
      (a, b) => b.project_count - a.project_count,
    );

    // 6. Compute evidence gaps from portfolio shape
    const gaps: CpcGap[] = [];

    for (const bu of portfolio) {
      if (bu.l2_claims === 0 && bu.l3_claims === 0 && bu.project_count >= 2) {
        gaps.push({
          area: `${bu.name}: no programme or strategic claims`,
          severity: "high",
          description: `${bu.project_count} project${bu.project_count > 1 ? "s" : ""} in corpus but only delivery-level claims (L1). Cannot support a programme or investment case for this business unit.`,
          project_count: bu.project_count,
          claim_count: bu.claim_count,
        });
      } else if (bu.l3_claims === 0 && bu.l2_claims > 0) {
        gaps.push({
          area: `${bu.name}: missing strategic outcome claims (L3)`,
          severity: "medium",
          description: `${bu.l2_claims} programme claim${bu.l2_claims > 1 ? "s" : ""} verified but no strategic outcome evidence. An L3 claim is needed before this can support a strategic investment case.`,
          project_count: bu.project_count,
          claim_count: bu.claim_count,
        });
      }
    }

    // Cross-portfolio gaps
    const totalClaims = cpcClaims.length;
    const verifiedCount = claimRows.filter((r) => r.confidence_tier === "verified").length;
    const aiInferredCount = claimRows.filter(
      (r) => r.confidence_tier === "ai_inferred" || r.confidence_tier === "pending_review",
    ).length;

    if (aiInferredCount > totalClaims * 0.5) {
      gaps.push({
        area: "Majority of claims are AI-inferred",
        severity: "medium",
        description: `${aiInferredCount} of ${totalClaims} claims are AI-inferred or pending review. Confidence across the portfolio is limited until human review completes.`,
        claim_count: aiInferredCount,
      });
    }

    if (verifiedCount === 0) {
      gaps.push({
        area: "No verified claims in corpus",
        severity: "high",
        description:
          "No claims have been independently verified. All evidence is self-reported or AI-inferred. Commission an evidence review sprint to verify at least 5 L2 claims.",
        claim_count: 0,
      });
    }

    // 7. Compute overall confidence tier
    const allTiers = cpcClaims.map((c) => c.confidence_tier);
    const overallTier: ConfidenceTier = aggregateTiers(allTiers);

    // 8. Containers as citations for the capability recipe
    const corpusCitations = containerRows.slice(0, 12).map((r) => ({
      id: r.id,
      title: r.name,
      organisation: r.business_unit ?? "CPC",
      score: r.source_confidence === "verified" ? 0.9 : r.source_confidence === "self_reported" ? 0.75 : 0.6,
      source_type: "project" as const,
    }));

    // 9. Response
    return NextResponse.json({
      ok: true,
      corpus_tag: "cpc_v0_1",
      generated_at: new Date().toISOString(),
      counts: {
        containers: containerRows.length,
        claims: cpcClaims.length,
        business_units: buMap.size,
        gaps: gaps.length,
        verified_claims: verifiedCount,
      },
      overall_confidence_tier: overallTier,
      corpus_citations: corpusCitations,
      cpc_claims: cpcClaims,
      cpc_portfolio: portfolio,
      cpc_gaps: gaps,
      // Summary text for the recipe
      summary: buildSummary(containerRows.length, cpcClaims, portfolio, overallTier),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cpc-intelligence]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(
  containerCount: number,
  claims: CpcClaim[],
  portfolio: CpcBusinessUnit[],
  tier: ConfidenceTier,
): string {
  const l1 = claims.filter((c) => c.level === 1).length;
  const l2 = claims.filter((c) => c.level === 2).length;
  const l3 = claims.filter((c) => c.level === 3).length;
  const buCount = portfolio.length;
  const strongBu = portfolio.filter((b) => b.l2_claims > 0 || b.l3_claims > 0);

  const parts: string[] = [
    `CPC Capability Corpus v0.1 contains ${containerCount} evidence containers across ${buCount} business unit${buCount !== 1 ? "s" : ""}.`,
    `${claims.length} claims extracted: ${l1} delivery (L1), ${l2} programme (L2), ${l3} strategic (L3).`,
  ];

  if (strongBu.length > 0) {
    const names = strongBu.map((b) => b.name).slice(0, 3).join(", ");
    parts.push(`Strongest evidence depth: ${names}.`);
  }

  const weakBu = portfolio.filter((b) => b.l2_claims === 0 && b.l3_claims === 0 && b.project_count > 0);
  if (weakBu.length > 0) {
    const names = weakBu.map((b) => b.name).slice(0, 2).join(", ");
    parts.push(`Evidence thin in: ${names} — L1 delivery claims only.`);
  }

  parts.push(`Overall confidence: ${tier}.`);
  return parts.join(" ");
}
