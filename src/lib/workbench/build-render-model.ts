/**
 * Atlas Workbench — Milestone 0.5 DB-backed render model builder.
 *
 * buildAtlasRenderModel(matchId, cqId) reads real atlas.* rows and returns a
 * valid AtlasRenderModel. Deterministic only — NO LLM, NO agents, NO LangGraph.
 *
 * Transport: Supabase JS admin client (HTTPS port 443), same as the rest of the
 * app. Previous pg.Pool (TCP port 6543) was correct for the matching pipeline
 * but unnecessary here and blocked in restricted network environments.
 *
 * Block assembly is per canonical question:
 *   browse    → ContextCard + ComparisonMatrix + RecommendationConfidence
 *   workbench → RecommendationConfidence + EvidenceStateSummary + DimensionGap
 *               + MatchBench + ClaimLedger
 *   act       → RecommendationConfidence + DimensionGap + ActionPlan
 *   defend    → RecommendationConfidence + ObjectionResponse + ProvenanceTrace
 *               + MatchBench
 *
 * Graceful degradation: only ~30 of 85 matches have populated evidence_map/gaps.
 * Empty data produces empty blocks + data_quality_notes, never a crash.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  AtlasRenderModel,
  CanonicalQuestionId,
  RenderBlock,
  InspectorEntry,
  DecisionSpine,
  SourceObject,
  TargetObject,
  GapItem,
  MatchBenchItem,
  ClaimLedgerItem,
  ActionPlanItem,
  ObjectionResponseItem,
  MatchListItem,
  ConfidenceTier,
} from "./atlas-render-model";
import {
  type MatchRow,
  type PassportRow,
  type ClaimRow,
  type ProjectRow,
  type LiveCallRow,
  toNumber,
  mapGaps,
  mapEvidenceMap,
  mapClaims,
  countEvidenceStates,
} from "./db-mappers";
import { deriveConfidence } from "./confidence";

// ---------------------------------------------------------------------------
// Error type — carries an HTTP status for the route handler
// ---------------------------------------------------------------------------

export class WorkbenchBuildError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "WorkbenchBuildError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Severity ordering for gap prioritisation (large/critical first)
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<GapItem["severity"], number> = {
  critical: 3,
  significant: 2,
  minor: 1,
};

function sortGaps(gaps: GapItem[]): GapItem[] {
  return [...gaps].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

// ---------------------------------------------------------------------------
// CQ → layout/mode metadata
// ---------------------------------------------------------------------------

const CQ_META: Record<CanonicalQuestionId, { mode: string; layout: string }> = {
  "cq.match.browse": { mode: "browse", layout: "comparison" },
  "cq.match.workbench": { mode: "workbench", layout: "evidence_workbench" },
  "cq.match.act": { mode: "act", layout: "action_plan" },
  "cq.match.defend": { mode: "defend", layout: "defence" },
};

// ---------------------------------------------------------------------------
// Recommendation phrasing from tier (deterministic)
// ---------------------------------------------------------------------------

function recommendationVerb(tier: ConfidenceTier): string {
  switch (tier) {
    case "Robust":
      return "Strong fit — pursue";
    case "Supported":
      return "Good fit — advance with checks";
    case "Indicative":
      return "Plausible fit — needs evidence";
    default:
      return "Weak fit — low priority";
  }
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export async function buildAtlasRenderModel(
  matchId: string,
  cqId: CanonicalQuestionId,
): Promise<AtlasRenderModel> {
  const sb = createAdminClient();
  const atlas = () => sb.schema("atlas");

  // --- 1. Match row ---
  const { data: match, error: matchErr } = await atlas()
    .from("matches")
    .select(
      "id, passport_id, project_id, live_call_id, match_type, match_score, match_summary, evidence_map, gaps, gap_value_estimate, created_at",
    )
    .eq("id", matchId)
    .single<MatchRow>();

  if (matchErr || !match) {
    const msg = matchErr?.message ?? "not found";
    throw new WorkbenchBuildError(
      msg.includes("0 rows") || msg.includes("JSON") ? `Match ${matchId} not found` : msg,
      msg.includes("0 rows") || msg.includes("JSON") ? 404 : 500,
    );
  }
  if (!match.passport_id) {
    throw new WorkbenchBuildError(`Match ${matchId} has no passport_id`, 422);
  }

  // --- 2. Passport ---
  const { data: passport } = await atlas()
    .from("passports")
    .select(
      "id, title, project_name, project_description, summary, owner_org, trl_level, sector_origin, sector_target",
    )
    .eq("id", match.passport_id)
    .single<PassportRow>();

  // --- 3. Claims (non-rejected) ---
  const { data: claimsRaw } = await atlas()
    .from("passport_claims")
    .select(
      "id, passport_id, claim_role, claim_domain, claim_text, conditions, confidence_tier, confidence_reason, source_excerpt, verified_at, rejected",
    )
    .eq("passport_id", match.passport_id)
    .or("rejected.is.null,rejected.eq.false")
    .order("created_at", { ascending: true });

  const claims: ClaimRow[] = claimsRaw ?? [];

  // --- 4. Target (project or live_call) ---
  let projectRow: ProjectRow | null = null;
  let liveCallRow: LiveCallRow | null = null;

  if (match.match_type === "project" && match.project_id) {
    const { data } = await atlas()
      .from("projects")
      .select("id, title, lead_funder, funding_amount, abstract, lead_org_name")
      .eq("id", match.project_id)
      .single<ProjectRow>();
    projectRow = data;
  } else if (match.live_call_id) {
    const { data } = await atlas()
      .from("live_calls")
      .select("id, title, funder, funding_amount, description, deadline, status")
      .eq("id", match.live_call_id)
      .single<LiveCallRow>();
    liveCallRow = data;
  }

  // --- 5. Normalise ---
  const matchScore = toNumber(match.match_score);

  // Supabase JS returns JSONB as parsed objects — cast to expected shapes
  const rawEvidenceMap = match.evidence_map as Record<string, string> | null;
  const rawGaps = match.gaps as Array<{
    gap_type?: string;
    severity?: string;
    gap_description?: string;
    addressable_by?: string;
  }> | null;

  const gaps = sortGaps(mapGaps(rawGaps));
  const evidenceItems = mapEvidenceMap(rawEvidenceMap, claims);
  const ledger = mapClaims(claims, rawEvidenceMap);
  const counts = countEvidenceStates(claims);
  const conf = deriveConfidence(counts, claims.length, gaps, matchScore);
  const economicGap = toNumber(match.gap_value_estimate);

  // --- 6. Data-quality notes ---
  const notes: string[] = [...conf.notes];
  if (!rawEvidenceMap || Object.keys(rawEvidenceMap).length === 0) {
    notes.push("This match has no evidence map — claim-by-claim verdicts are unavailable.");
  }
  if (!Array.isArray(rawGaps) || rawGaps.length === 0) {
    notes.push("No structured gaps were recorded for this match.");
  }
  if (claims.length === 0) {
    notes.push("The source passport has no active claims.");
  }
  if (!passport) {
    notes.push("Source passport row could not be loaded.");
  }
  if (match.match_type === "project" && !projectRow) {
    notes.push("Target project row could not be loaded.");
  }
  if (match.match_type === "live_call" && !liveCallRow) {
    notes.push("Target live-call row could not be loaded.");
  }

  // --- 7. Source / target objects ---
  const sourceTitle =
    passport?.title ?? passport?.project_name ?? "Untitled passport";
  const sourceObject: SourceObject = {
    type: "passport",
    id: match.passport_id,
    title: sourceTitle,
    summary:
      passport?.summary ??
      passport?.project_description ??
      "No passport summary available.",
  };

  const targetTitle =
    projectRow?.title ?? liveCallRow?.title ?? "Untitled target";
  const targetObject: TargetObject = {
    type: "project",
    id: match.project_id ?? match.live_call_id ?? "unknown",
    title: targetTitle,
    funder: projectRow?.lead_funder ?? liveCallRow?.funder ?? undefined,
    status: liveCallRow?.status ?? undefined,
    funding_amount:
      toNumber(projectRow?.funding_amount ?? liveCallRow?.funding_amount) ??
      undefined,
    lead_org: projectRow?.lead_org_name ?? undefined,
    abstract: projectRow?.abstract ?? liveCallRow?.description ?? undefined,
  };

  // --- 8. Decision spine ---
  const pct = matchScore !== null ? Math.round(matchScore * 100) : 0;
  const decisionHeadline = `${pct}% match — ${recommendationVerb(conf.tier)}`;
  const summaryText =
    match.match_summary ?? "No match summary was generated for this pairing.";

  const decisionSpine: DecisionSpine = {
    recommendation: recommendationVerb(conf.tier),
    decision: decisionHeadline,
    summary: summaryText,
    confidence_tier: conf.tier,
    confidence_cap_reason: conf.capReason,
    score: matchScore ?? 0,
    economic_gap_value: economicGap ?? undefined,
  };

  // --- 9. Build blocks for the requested CQ ---
  const blocks = buildBlocksForCq(cqId, {
    decisionHeadline,
    summaryText,
    matchScore,
    conf,
    counts,
    totalClaims: claims.length,
    gaps,
    evidenceItems,
    ledger,
    sourceObject,
    targetObject,
  });

  // --- 10. For browse, fetch sibling matches ---
  if (cqId === "cq.match.browse") {
    const siblings = await fetchSiblingMatches(sb, match.passport_id);
    blocks.push({
      id: "block-comparison",
      type: "ComparisonMatrix",
      visual: "stored_match_list",
      state: "core",
      headline: `${siblings.length} matches for this passport`,
      content: siblings,
    });
  }

  // --- 11. Inspector index ---
  const inspectorIndex = buildInspectorIndex({ conf, counts, totalClaims: claims.length, gaps, evidenceItems, ledger });

  // --- 12. Assemble ---
  const meta = CQ_META[cqId];
  return {
    artifact_id: `artifact.${match.id}.${cqId}`,
    model_version: "db-0.5",
    generated_at: new Date().toISOString(),
    canonical_question_id: cqId,
    layout_template: meta.layout,
    mode: meta.mode,
    source_object: sourceObject,
    target_object: targetObject,
    decision_spine: decisionSpine,
    blocks,
    inspector_index: inspectorIndex,
    snapshot: {
      title: `${sourceTitle} → ${targetTitle}`,
      included_blocks: blocks.map((b) => b.id),
      must_include: ["block-recommendation"],
    },
    data_quality_notes: notes,
  };
}

// ---------------------------------------------------------------------------
// Block assembly per CQ
// ---------------------------------------------------------------------------

interface BlockBuildCtx {
  decisionHeadline: string;
  summaryText: string;
  matchScore: number | null;
  conf: ReturnType<typeof deriveConfidence>;
  counts: ReturnType<typeof countEvidenceStates>;
  totalClaims: number;
  gaps: GapItem[];
  evidenceItems: MatchBenchItem[];
  ledger: ClaimLedgerItem[];
  sourceObject: SourceObject;
  targetObject: TargetObject;
}

function buildBlocksForCq(cqId: CanonicalQuestionId, ctx: BlockBuildCtx): RenderBlock[] {
  const recommendation = makeRecommendationBlock(ctx);
  const evidenceSummary = makeEvidenceStateSummaryBlock(ctx);
  const dimensionGap = makeDimensionGapBlock(ctx);
  const matchBench = makeMatchBenchBlock(ctx);
  const claimLedger = makeClaimLedgerBlock(ctx);

  switch (cqId) {
    case "cq.match.browse":
      return [makeContextCardBlock(ctx), recommendation];
    case "cq.match.act":
      return [recommendation, dimensionGap, makeActionPlanBlock(ctx), evidenceSummary];
    case "cq.match.defend":
      return [recommendation, makeObjectionResponseBlock(ctx), makeProvenanceTraceBlock(ctx), matchBench];
    case "cq.match.workbench":
    default:
      return [recommendation, evidenceSummary, dimensionGap, matchBench, claimLedger];
  }
}

function makeRecommendationBlock(ctx: BlockBuildCtx): RenderBlock {
  return {
    id: "block-recommendation",
    type: "RecommendationConfidence",
    visual: "decision_card",
    state: "core",
    headline: "Recommendation",
    content: {
      decision: ctx.decisionHeadline,
      summary: ctx.summaryText,
      score: ctx.matchScore ?? 0,
      confidence_tier: ctx.conf.tier,
      confidence_cap_reason: ctx.conf.capReason,
    },
  };
}

function makeEvidenceStateSummaryBlock(ctx: BlockBuildCtx): RenderBlock {
  return {
    id: "block-evidence-summary",
    type: "EvidenceStateSummary",
    visual: "evidence_state_bar",
    state: "core",
    headline: "Evidence state",
    content: { counts: ctx.counts, total_claims: ctx.totalClaims, cap_reason: ctx.conf.capReason },
  };
}

function makeDimensionGapBlock(ctx: BlockBuildCtx): RenderBlock {
  return {
    id: "block-gaps",
    type: "DimensionGap",
    visual: "source_target_gap_rows",
    state: "core",
    headline: `Evidence gaps (${ctx.gaps.length})`,
    content: ctx.gaps,
  };
}

function makeMatchBenchBlock(ctx: BlockBuildCtx): RenderBlock {
  return {
    id: "block-matchbench",
    type: "MatchBench",
    visual: "evidence_map_table",
    state: "core",
    headline: "Evidence map",
    content: ctx.evidenceItems,
  };
}

function makeClaimLedgerBlock(ctx: BlockBuildCtx): RenderBlock {
  return {
    id: "block-ledger",
    type: "ClaimLedger",
    visual: "claim_audit_ledger",
    state: "collapsed",
    headline: `Claim ledger (${ctx.ledger.length})`,
    content: ctx.ledger,
  };
}

function makeContextCardBlock(ctx: BlockBuildCtx): RenderBlock {
  return {
    id: "block-context",
    type: "ContextCard",
    visual: "paired_context_cards",
    state: "core",
    headline: "Context",
    content: {
      source: { id: ctx.sourceObject.id, title: ctx.sourceObject.title, summary: ctx.sourceObject.summary },
      target: {
        id: ctx.targetObject.id,
        title: ctx.targetObject.title,
        funder: ctx.targetObject.funder,
        lead_org: ctx.targetObject.lead_org,
        funding_amount: ctx.targetObject.funding_amount,
        status: ctx.targetObject.status,
        abstract: ctx.targetObject.abstract,
      },
    },
  };
}

function makeActionPlanBlock(ctx: BlockBuildCtx): RenderBlock {
  const actions: ActionPlanItem[] = ctx.gaps.map((gap, i) => ({
    action: `Address ${gap.title.toLowerCase()}: ${gap.description}`,
    linked_gap: gap.id,
    owner: ownerForGapType(gap.gap_type),
    sequence: i + 1,
  }));
  return {
    id: "block-actions",
    type: "ActionPlan",
    visual: "gap_to_action_timeline",
    state: "core",
    headline: `Action plan (${actions.length})`,
    content: actions,
  };
}

function makeObjectionResponseBlock(ctx: BlockBuildCtx): RenderBlock {
  const items: ObjectionResponseItem[] = ctx.gaps.map((gap) => ({
    challenge: `${gap.title}: ${gap.description}`,
    response:
      gap.what_would_change ??
      "No mitigating evidence is currently recorded; this gap remains open.",
    evidence_state: gap.evidence_state,
    provenance: gap.provenance,
    linked_gap_ids: [gap.id],
  }));
  return {
    id: "block-objections",
    type: "ObjectionResponse",
    visual: "objection_response_table",
    state: "core",
    headline: `Objections & responses (${items.length})`,
    content: items,
  };
}

function makeProvenanceTraceBlock(ctx: BlockBuildCtx): RenderBlock {
  return {
    id: "block-provenance",
    type: "ProvenanceTrace",
    visual: "evidence_trail",
    state: "core",
    headline: "Provenance trace",
    content: {
      path: ["atlas.passports", "atlas.passport_claims", "atlas.matches.evidence_map", "AtlasRenderModel"],
      evidence_map_items: ctx.evidenceItems,
    },
  };
}

function ownerForGapType(gapType: string): string {
  switch (gapType.toLowerCase()) {
    case "regulatory": return "Compliance lead";
    case "technology":
    case "capability": return "Technical lead";
    case "scope": return "Product lead";
    case "certification": return "Quality lead";
    default: return "Project lead";
  }
}

// ---------------------------------------------------------------------------
// Sibling matches for browse
// ---------------------------------------------------------------------------

async function fetchSiblingMatches(
  sb: ReturnType<typeof createAdminClient>,
  passportId: string,
): Promise<MatchListItem[]> {
  const { data } = await sb
    .schema("atlas")
    .from("matches")
    .select("id, match_type, match_score")
    .eq("passport_id", passportId)
    .order("match_score", { ascending: false })
    .limit(25);

  if (!data) return [];

  // Fetch target titles separately (PostgREST can't cross-schema join)
  return Promise.all(
    data.map(async (row) => {
      let target = "Untitled target";
      let funder: string | undefined;
      let status: string | undefined;

      if (row.match_type === "project") {
        const { data: p } = await sb
          .schema("atlas")
          .from("projects")
          .select("title, lead_funder")
          .eq("id", row.project_id)
          .single<{ title: string | null; lead_funder: string | null }>();
        target = p?.title ?? target;
        funder = p?.lead_funder ?? undefined;
      } else {
        const { data: lc } = await sb
          .schema("atlas")
          .from("live_calls")
          .select("title, funder, status")
          .eq("id", row.live_call_id)
          .single<{ title: string | null; funder: string | null; status: string | null }>();
        target = lc?.title ?? target;
        funder = lc?.funder ?? undefined;
        status = lc?.status ?? undefined;
      }

      return {
        match_id: row.id as string,
        passport: "—",
        target,
        score: toNumber(row.match_score) ?? 0,
        funder,
        status,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Inspector index
// ---------------------------------------------------------------------------

function buildInspectorIndex(ctx: {
  conf: ReturnType<typeof deriveConfidence>;
  counts: ReturnType<typeof countEvidenceStates>;
  totalClaims: number;
  gaps: GapItem[];
  evidenceItems: MatchBenchItem[];
  ledger: ClaimLedgerItem[];
}): Record<string, InspectorEntry> {
  const index: Record<string, InspectorEntry> = {};

  index["confidence"] = {
    title: "Confidence",
    kind: "confidence",
    content: { tier: ctx.conf.tier, cap_reason: ctx.conf.capReason, counts: ctx.counts, total_claims: ctx.totalClaims },
  };
  for (const gap of ctx.gaps) {
    index[gap.id] = { title: gap.title, kind: "gap", content: gap as unknown as Record<string, unknown> };
  }
  for (const item of ctx.evidenceItems) {
    index[item.id] = { title: "Evidence map entry", kind: "evidence_map", content: item as unknown as Record<string, unknown> };
  }
  for (const claim of ctx.ledger) {
    index[claim.id] = { title: "Passport claim", kind: "claim", content: claim as unknown as Record<string, unknown> };
  }
  return index;
}
