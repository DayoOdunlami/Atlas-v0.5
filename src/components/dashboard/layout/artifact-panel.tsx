"use client";

import { ArtifactBlock, RecipeType } from "@/lib/types";
import {
  BriefFiveCaseRecipe,
  EvidencePanelRecipe,
  StatsDashboardRecipe,
  ScenarioStressTestRecipe,
} from "@/components/dashboard/recipes";

const FIVE_CASE_SECTIONS = new Set([
  "Strategic Case",
  "Economic Case",
  "Commercial Case",
  "Financial Case",
  "Management Case",
]);

function detectRecipe(artifact: ArtifactBlock): RecipeType {
  // Prefer explicit recipe field set by the agent
  if (artifact.recipe) return artifact.recipe;
  // Fall back to type + section-name inference
  if (artifact.type === "scenario") return "scenario_stress_test";
  if (artifact.type === "chart") return "stats_dashboard";
  if (artifact.type === "evidence") return "evidence_panel";
  const keys = Object.keys(artifact.sections ?? {});
  if (keys.some((k) => FIVE_CASE_SECTIONS.has(k))) return "brief_five_case";
  return "brief_five_case";
}

interface ArtifactPanelProps {
  artifact: ArtifactBlock;
}

export function ArtifactPanel({ artifact }: ArtifactPanelProps) {
  const recipe = detectRecipe(artifact);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {recipe === "brief_five_case" && <BriefFiveCaseRecipe artifact={artifact} />}
      {recipe === "evidence_panel" && <EvidencePanelRecipe artifact={artifact} />}
      {recipe === "stats_dashboard" && <StatsDashboardRecipe artifact={artifact} />}
      {recipe === "scenario_stress_test" && <ScenarioStressTestRecipe artifact={artifact} />}
    </div>
  );
}
