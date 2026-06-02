"use client";

import { useState } from "react";
import { ArtifactBlock, ArtifactPanel as ArtifactPanelType, RecipeType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SourcesFooter } from "@/components/dashboard/layout/sources-footer";
import {
  BriefFiveCaseRecipe,
  EvidencePanelRecipe,
  StatsDashboardRecipe,
  ScenarioStressTestRecipe,
  CpcCapabilityAssessmentRecipe,
  CpcPortfolioComparisonRecipe,
  CpcMarketAlignmentRecipe,
  CpcEvidenceGapsRecipe,
  CpcOpportunityFitRecipe,
  CpcFundingFlowRecipe,
} from "@/components/dashboard/recipes";

const FIVE_CASE_SECTIONS = new Set([
  "Strategic Case",
  "Economic Case",
  "Commercial Case",
  "Financial Case",
  "Management Case",
]);

const RECIPE_LABELS: Record<RecipeType, string> = {
  brief_five_case:            "Investment Case",
  evidence_panel:             "Evidence",
  stats_dashboard:            "Statistics",
  scenario_stress_test:       "Scenario Analysis",
  cpc_capability_assessment:  "CPC Evidence Readiness",
  cpc_portfolio_comparison:   "Portfolio Comparison",
  cpc_market_alignment:       "Market Alignment",
  cpc_evidence_gaps:          "Evidence Gaps",
  cpc_opportunity_fit:        "Opportunity Fit",
  cpc_funding_flow:           "Funding Flow",
  orient:                     "ORIENT",
  connect:                    "CONNECT",
  diagnose:                   "DIAGNOSE",
  act:                        "ACT",
  defend:                     "DEFEND",
};

function detectRecipe(artifact: ArtifactBlock): RecipeType {
  if (artifact.recipe) return artifact.recipe;
  if (artifact.type === "scenario") return "scenario_stress_test";
  if (artifact.type === "chart") return "stats_dashboard";
  if (artifact.type === "evidence") return "evidence_panel";
  const keys = Object.keys(artifact.sections ?? {});
  if (keys.some((k) => FIVE_CASE_SECTIONS.has(k))) return "brief_five_case";
  return "brief_five_case";
}

function renderRecipe(artifact: ArtifactBlock, recipe: RecipeType) {
  switch (recipe) {
    case "brief_five_case":           return <BriefFiveCaseRecipe artifact={artifact} />;
    case "evidence_panel":            return <EvidencePanelRecipe artifact={artifact} />;
    case "stats_dashboard":           return <StatsDashboardRecipe artifact={artifact} />;
    case "scenario_stress_test":      return <ScenarioStressTestRecipe artifact={artifact} />;
    case "cpc_capability_assessment": return <CpcCapabilityAssessmentRecipe artifact={artifact} />;
    case "cpc_portfolio_comparison":  return <CpcPortfolioComparisonRecipe artifact={artifact} />;
    case "cpc_market_alignment":      return <CpcMarketAlignmentRecipe artifact={artifact} />;
    case "cpc_evidence_gaps":         return <CpcEvidenceGapsRecipe artifact={artifact} />;
    case "cpc_opportunity_fit":       return <CpcOpportunityFitRecipe artifact={artifact} />;
    case "cpc_funding_flow":          return <CpcFundingFlowRecipe artifact={artifact} />;
    default:                          return null;
  }
}

// ── Composite panel — secondary recipe rendered as collapsible section ────────

function CompositePanelSection({
  panel,
  baseArtifact,
}: {
  panel: ArtifactPanelType;
  baseArtifact: ArtifactBlock;
}) {
  const [open, setOpen] = useState(false);

  // Slice the parent artifact — keep citations/tier but swap in panel-specific data
  const sliced: ArtifactBlock = {
    ...baseArtifact,
    recipe: panel.recipe,
    sections: panel.sections ?? {},
    chart_specs: panel.chart_specs ?? [],
    cpc_claims: panel.cpc_claims ?? baseArtifact.cpc_claims,
    cpc_portfolio: panel.cpc_portfolio ?? baseArtifact.cpc_portfolio,
    cpc_gaps: panel.cpc_gaps ?? baseArtifact.cpc_gaps,
    recommendation_action: panel.recommendation_action ?? baseArtifact.recommendation_action,
    recommendation_rationale: panel.recommendation_rationale ?? baseArtifact.recommendation_rationale,
    confidence_tier: panel.confidence_tier ?? baseArtifact.confidence_tier,
    // Do NOT carry over panels — prevents recursive nesting
    panels: undefined,
  };

  const label = panel.label || RECIPE_LABELS[panel.recipe] || panel.recipe;

  return (
    <div className="border-t border-border">
      <button
        className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {/* Secondary indicator dot */}
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
        <span className="flex-1 text-xs font-semibold text-muted-foreground">{label}</span>
        {/* Recipe type badge */}
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground shrink-0">
          {RECIPE_LABELS[panel.recipe] ?? panel.recipe}
        </span>
        <svg
          className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-border/50">
          {renderRecipe(sliced, panel.recipe)}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface ArtifactPanelProps {
  artifact: ArtifactBlock;
}

export function ArtifactPanel({ artifact }: ArtifactPanelProps) {
  const recipe = detectRecipe(artifact);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Primary recipe */}
      {renderRecipe(artifact, recipe)}

      {/* Secondary panels — composite artifact for compound queries */}
      {artifact.panels?.map((panel, i) => (
        <CompositePanelSection key={i} panel={panel} baseArtifact={artifact} />
      ))}

      {/* Sources footer — collapsible, zero height when closed */}
      <SourcesFooter artifact={artifact} />
    </div>
  );
}
