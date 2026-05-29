"use client";

/**
 * Shared Chain of Thought component — used by Panels B, C, and D.
 * Extracted from panel-d-atlas-custom so all panels get identical CoT rendering.
 */

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Search,
  Database,
  Brain,
  ShieldCheck,
  Globe,
  Layers,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallDisplay, TraceToolCall } from "@/components/lab/types";

// ---------------------------------------------------------------------------
// Step icon — contextual per node name
// ---------------------------------------------------------------------------

const NODE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  search_corpus: Database,
  external_evidence_search: Globe,
  search_projects: Database,
  search_live_calls: Globe,
  build_five_case: Layers,
  reason_and_cite: Brain,
  verify_citations: ShieldCheck,
  retrieve_evidence: Search,
  select_recipe_intent: Zap,
  select_visual_recipe: Layers,
};

function StepIcon({ name, className }: { name: string; className?: string }) {
  const key = name.toLowerCase().replace(/ /g, "_");
  const Icon = NODE_ICONS[key] ?? Zap;
  return <Icon className={cn("shrink-0", className)} />;
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status?: "ok" | "error" | "skipped" }) {
  if (status === "error") return <XCircle className="size-3.5 text-red-400 shrink-0" />;
  if (status === "ok") return <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />;
  return (
    <span className="size-3.5 flex items-center justify-center shrink-0">
      <span className="size-2 rounded-full bg-amber-400/60 animate-pulse" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tool call row
// ---------------------------------------------------------------------------

function TraceToolCallRow({ tc }: { tc: TraceToolCall }) {
  const isLlm = tc.tool === "llm_invoke";
  return (
    <div className="flex items-start gap-2 pl-3 border-l-2 border-amber-200/40 py-0.5">
      <div
        className={cn(
          "mt-1.5 size-1.5 rounded-full shrink-0",
          tc.status === "ok" ? "bg-emerald-400" : tc.status === "error" ? "bg-red-400" : "bg-amber-300"
        )}
      />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-mono text-[10px] text-amber-800/80 leading-tight">
          {isLlm ? `llm_invoke · ${tc.model ?? "?"} · ${tc.prompt ?? "?"}` : tc.tool}
        </span>
        {(tc.result_count !== undefined || tc.checked !== undefined) && (
          <div className="flex flex-wrap gap-x-3">
            {tc.result_count !== undefined && (
              <span className="text-[9px] text-muted-foreground/70">
                {tc.result_count} result{tc.result_count !== 1 ? "s" : ""}
              </span>
            )}
            {tc.checked !== undefined && (
              <span className="text-[9px] text-muted-foreground/70">
                {tc.passed}/{tc.checked} verified{tc.removed ? ` · ${tc.removed} removed` : ""}
              </span>
            )}
          </div>
        )}
        {tc.error && (
          <span className="text-[9px] text-red-400/80 break-all">{tc.error}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single step row
// ---------------------------------------------------------------------------

interface StepRowProps {
  tc: ToolCallDisplay;
  idx: number;
  isLast: boolean;
  compact?: boolean;
}

function StepRow({ tc, idx, isLast, compact }: StepRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasToolCalls = (tc.trace?.tool_calls?.length ?? 0) > 0;
  const status = tc.trace?.status;

  return (
    <div className="relative flex gap-2.5">
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-amber-200/50" />
      )}
      <div
        className={cn(
          "size-5 rounded-full flex items-center justify-center border shrink-0 z-10",
          status === "ok" ? "bg-emerald-50 border-emerald-300" : status === "error" ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-300"
        )}
      >
        <StepIcon
          name={tc.id}
          className={cn(
            "size-2.5",
            status === "ok" ? "text-emerald-500" : status === "error" ? "text-red-400" : "text-amber-500"
          )}
        />
      </div>
      <div className="flex flex-col gap-0.5 pb-3 min-w-0 flex-1">
        <button
          onClick={() => hasToolCalls && setExpanded((e) => !e)}
          className={cn("flex items-center gap-1.5 text-left w-full", hasToolCalls && "cursor-pointer")}
          disabled={!hasToolCalls}
        >
          <span className={cn("font-medium leading-tight", compact ? "text-[10px]" : "text-xs",
            status === "ok" ? "text-emerald-700" : status === "error" ? "text-red-600" : "text-amber-800"
          )}>
            {tc.name}
          </span>
          {hasToolCalls && (
            <span className="ml-auto flex items-center gap-0.5 text-[9px] text-amber-500/70 shrink-0">
              {tc.trace!.tool_calls!.length} tool{tc.trace!.tool_calls!.length !== 1 ? "s" : ""}
              {expanded ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
            </span>
          )}
        </button>
        {tc.trace?.thought && (
          <p className={cn("text-amber-700/70 leading-snug", compact ? "text-[9px]" : "text-[10px]")}>
            {tc.trace.thought}
          </p>
        )}
        {expanded && hasToolCalls && (
          <div className="mt-1.5 flex flex-col gap-1">
            {tc.trace!.tool_calls!.map((ttc, i) => (
              <TraceToolCallRow key={i} tc={ttc} />
            ))}
          </div>
        )}
        {tc.kind === "action" && tc.args && tc.args !== "{}" && !tc.trace && (
          <span className={cn("font-mono text-muted-foreground/60 break-all", compact ? "text-[9px]" : "text-[10px]")}>
            {tc.args.length > 120 ? tc.args.slice(0, 120) + "…" : tc.args}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChainOfThought — the exported component
// ---------------------------------------------------------------------------

export interface ChainOfThoughtProps {
  toolCalls: ToolCallDisplay[];
  compact?: boolean;
  defaultOpen?: boolean;
}

export function ChainOfThought({ toolCalls, compact, defaultOpen }: ChainOfThoughtProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const doneCount = toolCalls.filter((tc) => tc.trace?.status === "ok").length;
  const errorCount = toolCalls.filter((tc) => tc.trace?.status === "error").length;
  const totalCount = toolCalls.length;
  const allDone = doneCount + errorCount === totalCount && totalCount > 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br from-amber-50/60 to-orange-50/30",
        compact ? "px-2 py-1.5 mb-1.5" : "px-3 py-2.5 mb-2"
      )}
      style={{ borderColor: "oklch(0.88 0.06 85)" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <div className={cn("flex items-center gap-1 shrink-0", compact ? "text-[10px]" : "text-xs")}>
          {allDone && errorCount === 0 ? (
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          ) : errorCount > 0 ? (
            <XCircle className="size-3.5 text-red-400" />
          ) : (
            <span className="size-3.5 flex items-center justify-center">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
            </span>
          )}
          <span className={cn("font-semibold",
            allDone && errorCount === 0 ? "text-emerald-700" : errorCount > 0 ? "text-red-600" : "text-amber-700"
          )}>
            {allDone && errorCount === 0 ? "Reasoning complete" : errorCount > 0 ? "Reasoning error" : "Reasoning…"}
          </span>
        </div>

        {!open && (
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
            {toolCalls.slice(0, 4).map((tc) => (
              <span
                key={tc.id}
                className={cn(
                  "shrink-0 rounded-full px-1.5 border font-medium",
                  compact ? "text-[8px]" : "text-[9px]",
                  tc.trace?.status === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : tc.trace?.status === "error" ? "bg-red-50 border-red-200 text-red-600"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                )}
              >
                {tc.name}
              </span>
            ))}
            {toolCalls.length > 4 && (
              <span className="text-[9px] text-muted-foreground/60 shrink-0">
                +{toolCalls.length - 4} more
              </span>
            )}
          </div>
        )}

        <span className={cn("ml-auto shrink-0 rounded-full px-1.5 font-mono border",
          compact ? "text-[8px]" : "text-[9px]",
          "bg-amber-100 text-amber-600 border-amber-200"
        )}>
          {doneCount}/{totalCount}
        </span>
        {open ? <ChevronDown className="size-3.5 shrink-0 text-amber-500/70" /> : <ChevronRight className="size-3.5 shrink-0 text-amber-500/70" />}
      </button>

      {open && (
        <div className={cn(compact ? "mt-2" : "mt-3")}>
          {toolCalls.map((tc, idx) => (
            <StepRow key={tc.id} tc={tc} idx={idx} isLast={idx === toolCalls.length - 1} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}
