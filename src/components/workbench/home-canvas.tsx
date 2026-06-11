"use client";

/**
 * HomeCanvas — the "ask anything" landing surface for /workbench.
 *
 * Shown when cqId === "cq.home" (no match loaded, default entry).
 * Designed for the JARVIS feel: calm, welcoming, intent-driven.
 *
 * Replaces ArtifactCanvas; chat panel + sidebar remain.
 *
 * As Tier 1B (always-emit-block) and Tier 2 (Stage model) come online,
 * the home canvas grows blocks in place when the agent emits patches —
 * so "ask a question" naturally becomes "fill the canvas with the answer."
 */

import * as React from "react";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import { useComposerRuntime } from "@assistant-ui/react";
import {
  Compass,
  Search,
  TrendingUp,
  GitCompare,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { BlockRenderer } from "./block-renderer";
import { BlockErrorBoundary } from "./block-error-boundary";

interface StarterIntent {
  id: string;
  label: string;
  description: string;
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const STARTER_INTENTS: StarterIntent[] = [
  {
    id: "explore-corpus",
    label: "Explore the CPC corpus",
    description: "Browse projects, funders, and themes across Connected Places Catapult",
    prompt: "What projects are in the CPC corpus and what themes do they cover?",
    icon: Compass,
    accent: "from-blue-500/10 to-violet-500/10 border-blue-200/50 dark:border-blue-800/40",
  },
  {
    id: "find-evidence",
    label: "Find evidence for a claim",
    description: "Search the corpus for projects that support or challenge a specific claim",
    prompt: "Find corpus evidence for projects working on real-time rail inspection.",
    icon: Search,
    accent: "from-emerald-500/10 to-teal-500/10 border-emerald-200/50 dark:border-emerald-800/40",
  },
  {
    id: "compare",
    label: "Compare two projects",
    description: "Side-by-side analysis of capabilities, gaps, and transfer potential",
    prompt: "Compare two CPC projects on rail inspection and tell me which is stronger.",
    icon: GitCompare,
    accent: "from-amber-500/10 to-orange-500/10 border-amber-200/50 dark:border-amber-800/40",
  },
  {
    id: "value-case",
    label: "Build a value case",
    description: "Run a Five Case economic analysis with NPV, drivers, and sensitivity",
    prompt: "Run a Five Case economic analysis for a UK rail AI inspection programme.",
    icon: TrendingUp,
    accent: "from-rose-500/10 to-pink-500/10 border-rose-200/50 dark:border-rose-800/40",
  },
  {
    id: "swot",
    label: "SWOT a portfolio",
    description: "Strengths, weaknesses, opportunities, threats for any sector or programme",
    prompt: "Give me a SWOT on the CPC innovation portfolio.",
    icon: Layers,
    accent: "from-violet-500/10 to-purple-500/10 border-violet-200/50 dark:border-violet-800/40",
  },
];

const EXAMPLE_QUESTIONS = [
  "What does CPC's portfolio cover?",
  "What are the gaps in UK rail innovation?",
  "Which funders back GPS-denied navigation?",
  "Show me maritime decarbonisation projects",
  "Which projects could partner on autonomous inspection?",
];

function StarterCard({ intent }: { intent: StarterIntent }) {
  const composer = useComposerRuntime();
  const Icon = intent.icon;

  const handleClick = React.useCallback(() => {
    composer.setText(intent.prompt);
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "[data-workbench-composer] textarea",
    );
    textarea?.focus();
  }, [composer, intent.prompt]);

  return (
    <button
      onClick={handleClick}
      className={`group text-left rounded-xl border bg-gradient-to-br ${intent.accent} p-4 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-foreground/30`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-background/80 border border-border flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
          <Icon className="w-4 h-4 text-foreground/80" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{intent.label}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {intent.description}
          </p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground/60 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </div>
    </button>
  );
}

function ExampleChip({ text }: { text: string }) {
  const composer = useComposerRuntime();

  const handleClick = React.useCallback(() => {
    composer.setText(text);
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "[data-workbench-composer] textarea",
    );
    textarea?.focus();
  }, [composer, text]);

  return (
    <button
      onClick={handleClick}
      className="text-xs rounded-full border border-border px-3 py-1.5 bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-muted/40 transition-colors"
    >
      {text}
    </button>
  );
}

export function HomeCanvas() {
  const { model, openInspector, appliedPatches } = useWorkbench();

  // Blocks emitted by the agent on the home canvas (none until Tier 1B lands)
  const hasBlocks = model.blocks.length > 0;
  const hasActivity = appliedPatches.length > 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Hero zone */}
      <div className="px-6 pt-10 pb-6 max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md bg-foreground text-background flex items-center justify-center text-xs font-bold">
            A
          </div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
            Atlas Workbench
          </span>
          <Sparkles className="w-3 h-3 text-muted-foreground/40" />
        </div>

        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          What do you want to know about the CPC innovation landscape?
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xl">
          Ask anything in the chat — explore projects, compare technologies, build briefs, run
          economic cases. Answers appear here as you go.
        </p>

        {/* Example chips */}
        <div className="flex flex-wrap gap-1.5 mt-5">
          {EXAMPLE_QUESTIONS.map((q) => (
            <ExampleChip key={q} text={q} />
          ))}
        </div>
      </div>

      {/* Starter intents grid */}
      {!hasActivity && (
        <div className="px-6 pb-8 max-w-3xl w-full mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              Start with an intent
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {STARTER_INTENTS.map((intent) => (
              <StarterCard key={intent.id} intent={intent} />
            ))}
          </div>
        </div>
      )}

      {/* Blocks zone — agent-emitted blocks land here. Wider than the hero so
          tables and quadrants get the breathing room they need. */}
      {hasBlocks && (
        <div className="px-6 pb-12 max-w-5xl w-full mx-auto space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              Your workspace
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {model.blocks.length} {model.blocks.length === 1 ? "card" : "cards"}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {model.blocks.map((block) => (
            <BlockErrorBoundary
              key={block.id}
              blockType={block.type}
              blockId={block.id}
            >
              <BlockRenderer block={block} onInspect={openInspector} />
            </BlockErrorBoundary>
          ))}
        </div>
      )}

      {/* Footer hint */}
      <div className="mt-auto px-6 py-3 border-t border-border/50 text-[10px] text-muted-foreground/50 text-center">
        Tip: changes apply live with one-click undo (Ctrl+Z). Pin any card to protect it from edits.
      </div>
    </div>
  );
}
