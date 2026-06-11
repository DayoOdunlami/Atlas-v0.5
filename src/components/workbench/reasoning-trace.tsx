"use client";

// ReasoningTrace — stream-ready reasoning/progress component.
//
// Inspired by AI Elements ChainOfThought / Reasoning patterns
// (https://elements.ai-sdk.dev/components/chain-of-thought).
//
// Renders a vertical timeline of ReasoningStep entries.
// Status icons animate on "active", resolve on "complete"/"error".
//
// This component is intentionally inert / demo-only for now.
// When the backend is wired, steps are populated via WorkbenchStreamEvent
// { type: "reasoning_trace", step: ReasoningStep } events.

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, XCircle, ChevronDown, ChevronUp, Brain } from "lucide-react";
import type { ReasoningStep } from "@/lib/workbench/atlas-render-model";

// ---------------------------------------------------------------------------
// Status icon
// ---------------------------------------------------------------------------

function StepIcon({ status }: { status: ReasoningStep["status"] }) {
  if (status === "complete") {
    return <CheckCircle2 className="w-4 h-4 text-evidence-verified shrink-0" />;
  }
  if (status === "active") {
    return <Loader2 className="w-4 h-4 text-accent shrink-0 animate-spin" />;
  }
  if (status === "error") {
    return <XCircle className="w-4 h-4 text-evidence-contested shrink-0" />;
  }
  return <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />;
}

// ---------------------------------------------------------------------------
// Single step row
// ---------------------------------------------------------------------------

function StepRow({ step, isLast }: { step: ReasoningStep; isLast: boolean }) {
  return (
    <div className="flex gap-3 relative">
      {/* Vertical connector line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[7px] top-5 bottom-0 w-px",
            step.status === "complete" ? "bg-evidence-verified/30" : "bg-border",
          )}
        />
      )}

      {/* Icon */}
      <div className="mt-0.5 z-10">
        <StepIcon status={step.status} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <p
          className={cn(
            "text-xs font-medium leading-snug",
            step.status === "complete" && "text-foreground",
            step.status === "active" && "text-accent",
            step.status === "pending" && "text-muted-foreground/60",
            step.status === "error" && "text-evidence-contested",
          )}
        >
          {step.label}
        </p>
        {step.detail && step.status !== "pending" && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.detail}</p>
        )}
        {step.evidence_ids && step.evidence_ids.length > 0 && step.status === "complete" && (
          <div className="mt-1 flex flex-wrap gap-1">
            {step.evidence_ids.slice(0, 3).map((id) => (
              <span
                key={id}
                className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {id.slice(0, 8)}…
              </span>
            ))}
            {step.evidence_ids.length > 3 && (
              <span className="text-[11px] text-muted-foreground">
                +{step.evidence_ids.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReasoningTrace
// ---------------------------------------------------------------------------

export interface ReasoningTraceProps {
  steps: ReasoningStep[];
  /** When true, the trace is collapsed by default. Default: false. */
  defaultCollapsed?: boolean;
  /** Optional label for the collapsible header */
  label?: string;
  className?: string;
}

export function ReasoningTrace({
  steps,
  defaultCollapsed = false,
  label = "Reasoning trace",
  className,
}: ReasoningTraceProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const hasActive = steps.some((s) => s.status === "active");
  const hasError = steps.some((s) => s.status === "error");
  const allComplete = steps.length > 0 && steps.every((s) => s.status === "complete");
  const completedCount = steps.filter((s) => s.status === "complete").length;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        hasError && "border-red-200",
        className,
      )}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <Brain
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            hasActive && "text-accent animate-pulse",
            allComplete && "text-evidence-verified",
            hasError && "text-evidence-contested",
            !hasActive && !allComplete && !hasError && "text-muted-foreground",
          )}
        />
        <span className="text-xs font-semibold text-foreground flex-1 text-left">{label}</span>

        {/* Progress summary */}
        <span className="text-xs text-muted-foreground">
          {hasActive ? (
            <span className="text-accent font-medium">Running…</span>
          ) : hasError ? (
            <span className="text-evidence-contested font-medium">Error</span>
          ) : allComplete ? (
            <span className="text-evidence-verified font-medium">Done</span>
          ) : (
            <span>{completedCount} / {steps.length}</span>
          )}
        </span>

        {collapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Step list */}
      {!collapsed && steps.length > 0 && (
        <div className="px-4 pt-3">
          {steps.map((step, i) => (
            <StepRow key={`${step.label}-${i}`} step={step} isLast={i === steps.length - 1} />
          ))}
        </div>
      )}

      {!collapsed && steps.length === 0 && (
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">No steps yet.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo preset — used in ArtifactCanvas while backend is not yet wired.
// Represents a typical buildAtlasRenderModel() run.
// ---------------------------------------------------------------------------

export const DEMO_REASONING_STEPS: ReasoningStep[] = [
  {
    label: "Loading match data",
    detail: "Reading atlas.matches for passport → project pair",
    status: "complete",
    evidence_ids: ["m-a3f2c1d4-e5b6", "p-8c7d9a0b"],
  },
  {
    label: "Building decision spine",
    detail: "Derived recommendation, score and confidence tier",
    status: "complete",
  },
  {
    label: "Checking evidence map",
    detail: "Mapped 10 passport claims against project evidence",
    status: "complete",
    evidence_ids: ["c-001", "c-002", "c-003"],
  },
  {
    label: "Applying confidence cap",
    detail: "All claims are self-reported → capped at Indicative",
    status: "complete",
  },
  {
    label: "Rendering blocks",
    detail: "Assembled 5 blocks for cq.match.workbench layout",
    status: "complete",
  },
  {
    label: "Committing AtlasRenderModel",
    detail: "Model v1.0 committed — source of truth locked",
    status: "complete",
  },
];
