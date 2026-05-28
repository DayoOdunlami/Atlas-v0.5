"use client";

/**
 * Panel D — Atlas Custom renderer.
 *
 * Visual design inspired by ai-elements ChainOfThought patterns, adapted for
 * our CopilotKit/LangGraph data shape (no AI SDK dependency).
 *
 * Three Atlas-specific features on top of a standard message thread:
 *   1. Chain of Thought — step pipeline with status icons, thoughts, tool rows
 *   2. Inline citations — UUID / [N] patterns rendered as chips
 *   3. Tool call display — collapsed Tool block (expandable)
 */

import { useRef, useEffect, useState } from "react";
import type { DisplayMessage, ToolCallDisplay, TraceToolCall } from "@/components/lab/types";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/chat/layout/markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Database,
  Brain,
  ShieldCheck,
  Globe,
  Layers,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Citation parsing
// ---------------------------------------------------------------------------

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const REF_RE = /\[(\d+)\]/g;

function extractCitations(text: string): string[] {
  const uuids = text.match(UUID_RE) ?? [];
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(text)) !== null) {
    refs.push(`[${m[1]}]`);
  }
  return [...new Set([...uuids, ...refs])];
}

// ---------------------------------------------------------------------------
// Step icon — maps known node names to a contextual icon
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
};

function StepIcon({ name, className }: { name: string; className?: string }) {
  const Icon = NODE_ICONS[name.toLowerCase().replace(/ /g, "_")] ?? Zap;
  return <Icon className={cn("shrink-0", className)} />;
}

// ---------------------------------------------------------------------------
// Status dot / icon
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status?: "ok" | "error" | "skipped" }) {
  if (status === "error")
    return <XCircle className="size-3.5 text-red-400 shrink-0" />;
  if (status === "ok")
    return <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />;
  return (
    <span className="size-3.5 flex items-center justify-center shrink-0">
      <span className="size-2 rounded-full bg-amber-400/60 animate-pulse" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tool call row — individual tool call inside an expanded step
// ---------------------------------------------------------------------------

function TraceToolCallRow({ tc }: { tc: TraceToolCall }) {
  const isLlm = tc.tool === "llm_invoke";
  const hasCounts = tc.result_count !== undefined || tc.checked !== undefined;

  return (
    <div className="flex items-start gap-2 pl-3 border-l-2 border-amber-200/40 py-0.5">
      <div
        className={cn(
          "mt-0.5 size-1.5 rounded-full shrink-0 mt-1.5",
          tc.status === "ok"
            ? "bg-emerald-400"
            : tc.status === "error"
            ? "bg-red-400"
            : "bg-amber-300"
        )}
      />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-mono text-[10px] text-amber-800/80 leading-tight">
          {isLlm
            ? `llm_invoke · ${tc.model ?? "?"} · ${tc.prompt ?? "?"}`
            : tc.tool}
        </span>
        {hasCounts && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {tc.result_count !== undefined && (
              <span className="text-[9px] text-muted-foreground/70">
                {tc.result_count} result{tc.result_count !== 1 ? "s" : ""}
              </span>
            )}
            {tc.checked !== undefined && (
              <span className="text-[9px] text-muted-foreground/70">
                {tc.passed}/{tc.checked} verified
                {tc.removed ? ` · ${tc.removed} removed` : ""}
              </span>
            )}
          </div>
        )}
        {tc.error && (
          <span className="text-[9px] text-red-400/80 break-all leading-tight">
            {tc.error}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single CoT step row
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
  const canExpand = hasToolCalls;
  const status = tc.trace?.status;

  return (
    <div className="relative flex gap-2.5">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-amber-200/50" />
      )}

      {/* Step badge */}
      <div className="flex-none flex flex-col items-center gap-0">
        <div
          className={cn(
            "size-5 rounded-full flex items-center justify-center border shrink-0 z-10",
            status === "ok"
              ? "bg-emerald-50 border-emerald-300"
              : status === "error"
              ? "bg-red-50 border-red-300"
              : "bg-amber-50 border-amber-300"
          )}
        >
          <StepIcon
            name={tc.id}
            className={cn(
              "size-2.5",
              status === "ok"
                ? "text-emerald-500"
                : status === "error"
                ? "text-red-400"
                : "text-amber-500"
            )}
          />
        </div>
      </div>

      {/* Step body */}
      <div className="flex flex-col gap-0.5 pb-3 min-w-0 flex-1">
        {/* Header row */}
        <button
          onClick={() => canExpand && setExpanded((e) => !e)}
          className={cn(
            "flex items-center gap-1.5 text-left w-full",
            canExpand && "cursor-pointer"
          )}
          disabled={!canExpand}
        >
          <span
            className={cn(
              "font-medium leading-tight",
              compact ? "text-[10px]" : "text-xs",
              status === "ok"
                ? "text-emerald-700"
                : status === "error"
                ? "text-red-600"
                : "text-amber-800"
            )}
          >
            {tc.name}
          </span>
          {hasToolCalls && (
            <span className="ml-auto flex items-center gap-0.5 text-[9px] text-amber-500/70 shrink-0">
              {tc.trace!.tool_calls!.length} tool
              {tc.trace!.tool_calls!.length !== 1 ? "s" : ""}
              {expanded ? (
                <ChevronDown className="size-2.5" />
              ) : (
                <ChevronRight className="size-2.5" />
              )}
            </span>
          )}
        </button>

        {/* Thought text */}
        {tc.trace?.thought && (
          <p
            className={cn(
              "text-amber-700/70 leading-snug",
              compact ? "text-[9px]" : "text-[10px]"
            )}
          >
            {tc.trace.thought}
          </p>
        )}

        {/* Tool call rows (expanded) */}
        {expanded && hasToolCalls && (
          <div className="mt-1.5 flex flex-col gap-1">
            {tc.trace!.tool_calls!.map((ttc, i) => (
              <TraceToolCallRow key={i} tc={ttc} />
            ))}
          </div>
        )}

        {/* Action args for frontend actions without trace */}
        {tc.kind === "action" && tc.args && tc.args !== "{}" && !tc.trace && (
          <span
            className={cn(
              "font-mono text-muted-foreground/60 break-all leading-tight",
              compact ? "text-[9px]" : "text-[10px]"
            )}
          >
            {tc.args.length > 120 ? tc.args.slice(0, 120) + "…" : tc.args}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chain of Thought — timeline layout, collapsible header
// ---------------------------------------------------------------------------

interface ChainOfThoughtProps {
  toolCalls: ToolCallDisplay[];
  compact?: boolean;
}

function ChainOfThought({ toolCalls, compact }: ChainOfThoughtProps) {
  const [open, setOpen] = useState(false);

  const doneCount = toolCalls.filter((tc) => tc.trace?.status === "ok").length;
  const errorCount = toolCalls.filter((tc) => tc.trace?.status === "error").length;
  const totalCount = toolCalls.length;
  const allDone = doneCount + errorCount === totalCount;

  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br from-amber-50/60 to-orange-50/30",
        compact ? "px-2 py-1.5 mb-1.5" : "px-3 py-2.5 mb-2"
      )}
      style={{ borderColor: "oklch(0.88 0.06 85)" }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        {/* Status indicator */}
        <div
          className={cn(
            "flex items-center gap-1 shrink-0",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {allDone && errorCount === 0 ? (
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          ) : errorCount > 0 ? (
            <XCircle className="size-3.5 text-red-400" />
          ) : (
            <span className="size-3.5 flex items-center justify-center">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
            </span>
          )}
          <span
            className={cn(
              "font-semibold",
              allDone && errorCount === 0
                ? "text-emerald-700"
                : errorCount > 0
                ? "text-red-600"
                : "text-amber-700"
            )}
          >
            {allDone && errorCount === 0
              ? "Reasoning complete"
              : errorCount > 0
              ? "Reasoning error"
              : "Reasoning…"}
          </span>
        </div>

        {/* Step pills summary (collapsed view) */}
        {!open && (
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
            {toolCalls.slice(0, 4).map((tc, i) => (
              <span
                key={tc.id}
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0 border font-medium",
                  compact ? "text-[8px]" : "text-[9px]",
                  tc.trace?.status === "ok"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : tc.trace?.status === "error"
                    ? "bg-red-50 border-red-200 text-red-600"
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

        {/* Step count badge */}
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-1.5 font-mono",
            compact ? "text-[8px]" : "text-[9px]",
            "bg-amber-100 text-amber-600 border border-amber-200"
          )}
        >
          {doneCount}/{totalCount}
        </span>

        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-amber-500/70" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-amber-500/70" />
        )}
      </button>

      {/* Steps timeline */}
      {open && (
        <div className={cn(compact ? "mt-2" : "mt-3")}>
          {toolCalls.map((tc, idx) => (
            <StepRow
              key={tc.id}
              tc={tc}
              idx={idx}
              isLast={idx === toolCalls.length - 1}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline citation chip
// ---------------------------------------------------------------------------

function CitationChip({ label }: { label: string }) {
  const isUuid = label.includes("-");
  const display = isUuid ? label.slice(0, 8) + "…" : label;
  return (
    <Badge
      variant="outline"
      className="inline-flex items-center text-[10px] font-mono px-1 py-0 h-4 border-primary/30 text-primary/70 hover:border-primary/60 cursor-default"
      title={isUuid ? label : undefined}
    >
      {display}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Tool block (expandable) — for frontend action display
// ---------------------------------------------------------------------------

interface ToolBlockProps {
  tc: ToolCallDisplay;
  compact?: boolean;
}

function ToolBlock({ tc, compact }: ToolBlockProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/40 overflow-hidden",
        compact ? "text-[10px]" : "text-xs"
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-muted/60 transition-colors text-left"
      >
        <Wrench className="size-3 text-muted-foreground shrink-0" />
        <span className="font-mono text-muted-foreground truncate flex-1">
          {tc.name}
        </span>
        {open ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <pre className="px-3 pb-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all border-t bg-muted/20">
          {tc.args || "{}"}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel D
// ---------------------------------------------------------------------------

export interface PanelDProps {
  messages: DisplayMessage[];
  isLoading: boolean;
  compact?: boolean;
}

export function PanelDAtlas({ messages, isLoading, compact }: PanelDProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 overflow-y-auto flex-1 min-h-0",
        compact && "p-2 gap-2"
      )}
    >
      {!compact && (
        <div className="flex items-center gap-2 pb-2 border-b mb-1 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Atlas Custom
          </span>
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
            CoT · Citations · Tools
          </Badge>
        </div>
      )}

      {messages.length === 0 && !isLoading && (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        </div>
      )}

      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const citations = isUser ? [] : extractCitations(msg.content);
        const toolCalls = msg.toolCalls ?? [];

        if (isUser) {
          return (
            <div key={msg.id} className="flex justify-end">
              <Card
                className={cn(
                  "max-w-[80%] bg-accent/10 border-accent/40",
                  compact && "text-xs"
                )}
              >
                <CardContent
                  className={cn(
                    "whitespace-pre-wrap",
                    compact ? "px-2 py-1.5" : "px-3 py-2"
                  )}
                >
                  {msg.content}
                </CardContent>
              </Card>
            </div>
          );
        }

        return (
          <div key={msg.id} className={cn("flex flex-col gap-2", compact && "gap-1")}>
            {/* Chain of thought (node steps) */}
            {toolCalls.filter((tc) => tc.kind === "node").length > 0 && (
              <ChainOfThought
                toolCalls={toolCalls.filter((tc) => tc.kind === "node")}
                compact={compact}
              />
            )}

            {/* Frontend action tool blocks (non-compact only) */}
            {!compact &&
              toolCalls.filter((tc) => tc.kind === "action").length > 0 && (
                <div className="flex flex-col gap-1 mb-1">
                  {toolCalls
                    .filter((tc) => tc.kind === "action")
                    .map((tc) => (
                      <ToolBlock key={tc.id} tc={tc} compact={compact} />
                    ))}
                </div>
              )}

            {/* Message content */}
            {msg.content && (
              <div
                className={cn(
                  "text-foreground rounded-lg",
                  compact ? "text-xs px-1" : "px-0.5"
                )}
              >
                <Markdown content={msg.content} />
              </div>
            )}

            {/* Citation chips */}
            {citations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {citations.map((c) => (
                  <CitationChip key={c} label={c} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex items-center gap-2 py-1">
          <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-muted-foreground animate-pulse">
            Analysing evidence…
          </span>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
