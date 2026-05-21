"use client";

import { ArtifactBlock, ConfidenceTier } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIER_BADGE: Record<ConfidenceTier, string> = {
  Speculative: "bg-red-50 text-red-700 border-red-200",
  Indicative:  "bg-amber-50 text-amber-700 border-amber-200",
  Supported:   "bg-blue-50 text-blue-700 border-blue-200",
  Robust:      "bg-green-50 text-green-700 border-green-200",
};

function AssumptionText({ text }: { text: string }) {
  // Colour [FRAGILE] and [UNVERIFIED] tags
  const parts = text.split(/(\[HELD\]|\[FRAGILE\]|\[UNVERIFIED\])/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part === "[HELD]")
          return <span key={i} className="font-semibold text-green-700">[HELD]</span>;
        if (part === "[FRAGILE]")
          return <span key={i} className="font-semibold text-amber-700">[FRAGILE]</span>;
        if (part === "[UNVERIFIED]")
          return <span key={i} className="font-semibold text-red-700">[UNVERIFIED]</span>;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function Column({
  heading,
  body,
  accent,
}: {
  heading: string;
  body: string;
  accent: "green" | "red";
}) {
  const accentStyle =
    accent === "green"
      ? "border-t-2 border-t-green-500 bg-green-50/40"
      : "border-t-2 border-t-red-400 bg-red-50/30";
  const headingStyle = accent === "green" ? "text-green-700" : "text-red-700";

  return (
    <div className={cn("rounded-lg border border-border p-3", accentStyle)}>
      <h3 className={cn("text-xs font-semibold uppercase tracking-wide mb-2", headingStyle)}>
        {heading}
      </h3>
      <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{body}</p>
    </div>
  );
}

interface Props {
  artifact: ArtifactBlock;
}

export function ScenarioStressTestRecipe({ artifact }: Props) {
  const sections = artifact.sections ?? {};

  const hypothesis =
    sections["Hypothesis"] ?? sections["Scenario"] ?? null;
  const supporting = sections["Supporting Evidence"] ?? null;
  const challenging = sections["Challenging Evidence"] ?? null;
  const assumptions = sections["Key Assumptions"] ?? null;
  const verdict = sections["Verdict"] ?? null;

  // Any section not in the known set
  const knownKeys = new Set([
    "Hypothesis", "Scenario",
    "Supporting Evidence", "Challenging Evidence",
    "Key Assumptions", "Verdict",
  ]);
  const extras = Object.entries(sections).filter(([k]) => !knownKeys.has(k));

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Scenario Stress Test
        </span>
        <span
          className={cn(
            "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
            TIER_BADGE[artifact.confidence_tier],
          )}
        >
          {artifact.confidence_tier}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Hypothesis banner */}
        {hypothesis && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">
              Hypothesis
            </p>
            <p className="text-sm font-medium text-indigo-900 leading-snug">
              {hypothesis}
            </p>
          </div>
        )}

        {/* For / Against columns */}
        {(supporting || challenging) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {supporting && (
              <Column heading="Supporting Evidence" body={supporting} accent="green" />
            )}
            {challenging && (
              <Column heading="Challenging Evidence" body={challenging} accent="red" />
            )}
          </div>
        )}

        {/* Key Assumptions */}
        {assumptions && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Key Assumptions
            </h3>
            <div className="space-y-1">
              {assumptions.split("\n").map((line, i) => (
                <p key={i} className="text-sm text-foreground/85 leading-relaxed">
                  <AssumptionText text={line} />
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Extra sections */}
        {extras.map(([heading, body]) => (
          <div key={heading}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              {heading}
            </h3>
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
              {body}
            </p>
          </div>
        ))}

        {/* Verdict */}
        {verdict && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-start gap-3">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-0.5">
              Verdict
            </span>
            <p className="text-sm font-medium text-foreground leading-snug">{verdict}</p>
          </div>
        )}

        {Object.keys(sections).length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            Ask the agent to stress-test a scenario or hypothesis.
          </p>
        )}
      </div>
    </div>
  );
}
