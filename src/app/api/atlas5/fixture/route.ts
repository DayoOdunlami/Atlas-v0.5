/**
 * Atlas 5 — Fixture injection endpoint (Tier 1 validation)
 *
 * DEV-ONLY. Returns a validated ArtifactBlock fixture and a machine-readable
 * render-readiness report. Used by Claude for terminal-based validation and
 * by Playwright smoke tests for fast, auth-free contract checks.
 *
 * Usage:
 *   curl "http://localhost:3000/api/atlas5/fixture?recipe=brief_five_case"
 *   curl "http://localhost:3000/api/atlas5/fixture?recipe=evidence_panel"
 *   curl "http://localhost:3000/api/atlas5/fixture?recipe=stats_dashboard"
 *   curl "http://localhost:3000/api/atlas5/fixture?recipe=scenario_stress_test"
 *   curl "http://localhost:3000/api/atlas5/fixture?recipe=legacy_brief"
 *   curl "http://localhost:3000/api/atlas5/fixture?recipe=orient"
 *   curl "http://localhost:3000/api/atlas5/fixture?recipe=connect"
 *   curl "http://localhost:3000/api/atlas5/fixture?recipe=defend"
 *
 * Returns JSON:
 *   ok                    boolean — fixture loaded and schema-valid
 *   requested_recipe      string  — the ?recipe= param received
 *   recipe_detected       string|null — what detectRecipe() would return
 *   type                  string  — artifact.type
 *   sections_count        number
 *   chart_specs_count     number
 *   citations_count       number
 *   has_decision_spine    false (Decision Spine is set separately by agent)
 *   has_evidence_coverage false (computed at agent runtime, not in fixture)
 *   missing_required_fields string[] — fields that are undefined but should exist
 *   can_render            boolean — true when recipe_detected matches requested_recipe
 *                                   OR legacy_brief falls through correctly
 *   schema_issues         string[] — Zod validation issues (empty = clean)
 *   fixture               object  — the full ArtifactBlock (for inspection)
 *
 * Security:
 *   - Returns 404 in production
 *   - No service-role keys or auth secrets returned
 *   - No database queries — fixture data only
 */

import { NextRequest, NextResponse } from "next/server";

import { ArtifactBlockSchema } from "@/lib/atlas5/artifact-schema";
import {
  FIXTURE_MAP,
  FIXTURE_DECISION_SPINE,
  type FixtureName,
} from "../../../../../eval/fixtures/artifact-blocks";
import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import type { RecipeType } from "@/lib/atlas5/types";

// ---------------------------------------------------------------------------
// detectRecipe — mirrors artifact-pane.tsx detectRecipe() logic exactly.
// Keep these two in sync manually (or extract to a shared util at D10).
// ---------------------------------------------------------------------------

const FIVE_CASE_KEYS = new Set([
  "Strategic Case",
  "Economic Case",
  "Commercial Case",
  "Financial Case",
  "Management Case",
]);

function detectRecipe(artifact: ArtifactBlock): RecipeType | null {
  if (artifact.recipe) return artifact.recipe;
  if (artifact.type === "scenario") return "scenario_stress_test";
  if (artifact.type === "chart") return "stats_dashboard";
  if (artifact.type === "evidence") return "evidence_panel";
  const keys = Object.keys(artifact.sections ?? {});
  if (keys.some((k) => FIVE_CASE_KEYS.has(k))) return "brief_five_case";
  return null; // legacy lowercase sections → BriefView fallback
}

// ---------------------------------------------------------------------------
// Required-field check per recipe
// ---------------------------------------------------------------------------

function getMissingFields(
  artifact: ArtifactBlock,
  recipe: RecipeType | null,
): string[] {
  const missing: string[] = [];

  // All artefacts must have confidence_tier
  if (!artifact.confidence_tier) missing.push("confidence_tier");

  switch (recipe) {
    case "brief_five_case":
      if (!artifact.sections || Object.keys(artifact.sections).length === 0)
        missing.push("sections");
      break;
    case "evidence_panel":
      if (!artifact.corpus_citations || artifact.corpus_citations.length === 0)
        missing.push("corpus_citations (at least one)");
      break;
    case "stats_dashboard":
      // chart_specs are optional (can show just NPV or text sections)
      break;
    case "scenario_stress_test":
      if (
        !artifact.sections?.["Hypothesis"] &&
        !artifact.sections?.["Scenario"]
      )
        missing.push("sections.Hypothesis or sections.Scenario");
      break;
    case "orient": {
      const a = artifact as { orient_domains?: unknown[] };
      if (!a.orient_domains || a.orient_domains.length === 0)
        missing.push("orient_domains");
      if (!artifact.sections?.["Headline"])
        missing.push("sections.Headline");
      break;
    }
    case "connect": {
      const a = artifact as { connect_opportunities?: unknown[] };
      if (!a.connect_opportunities || a.connect_opportunities.length === 0)
        missing.push("connect_opportunities");
      if (!artifact.sections?.["Headline"])
        missing.push("sections.Headline");
      break;
    }
    case "diagnose":
      // diagnose = extended evidence_panel; corpus_citations required
      if (!artifact.corpus_citations || artifact.corpus_citations.length === 0)
        missing.push("corpus_citations (at least one)");
      break;
    case "act":
      // act = extended brief_five_case; sections required
      if (!artifact.sections || Object.keys(artifact.sections).length === 0)
        missing.push("sections");
      break;
    case "defend": {
      const a = artifact as { defend_evidence?: unknown[] };
      if (!a.defend_evidence || a.defend_evidence.length === 0)
        missing.push("defend_evidence");
      if (!artifact.sections?.["Headline"])
        missing.push("sections.Headline");
      break;
    }
    case null:
      // legacy BriefView — sections should exist
      if (!artifact.sections || Object.keys(artifact.sections).length === 0)
        missing.push("sections");
      break;
  }

  return missing;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Tier 1 guard: dev / test only
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedRecipe = searchParams.get("recipe") ?? "brief_five_case";

  // Resolve fixture
  const fixture =
    FIXTURE_MAP[requestedRecipe as FixtureName] ??
    FIXTURE_MAP["brief_five_case"];

  // Schema validation (Tier 2 check — advisory)
  const schemaResult = ArtifactBlockSchema.safeParse(fixture);
  const schemaIssues = schemaResult.success
    ? []
    : schemaResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);

  // Recipe detection
  const recipeDetected = detectRecipe(fixture);

  // Missing field check
  const missingFields = getMissingFields(fixture, recipeDetected);

  // can_render: either recipe matches request OR legacy_brief falls through correctly
  const isLegacyBriefRequest = requestedRecipe === "legacy_brief";
  const canRender = isLegacyBriefRequest
    ? recipeDetected === null // legacy path: detectRecipe returns null → BriefView
    : recipeDetected === requestedRecipe;

  return NextResponse.json({
    ok: schemaIssues.length === 0 && canRender,
    requested_recipe: requestedRecipe,
    recipe_detected: recipeDetected,
    type: fixture.type,
    sections_count: Object.keys(fixture.sections ?? {}).length,
    chart_specs_count: (fixture.chart_specs ?? []).length,
    citations_count:
      (fixture.corpus_citations ?? []).length +
      (fixture.hive_citations ?? []).length,
    has_decision_spine: false, // Decision Spine is populated separately by agent at runtime
    has_evidence_coverage: false, // Computed at agent runtime, not in fixture
    missing_required_fields: missingFields,
    can_render: canRender,
    schema_issues: schemaIssues,
    // Include the decision spine fixture for reference (not wired to store here)
    decision_spine_available: !!FIXTURE_DECISION_SPINE,
    fixture,
  });
}
