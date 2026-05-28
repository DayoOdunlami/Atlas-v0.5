"use client";

/**
 * Panel D — Atlas Custom renderer.
 * Three Atlas-specific features on top of a standard message thread:
 *   1. Chain of Thought — collapsible tool-call steps above each agent message
 *   2. Inline citations — UUID / [N] patterns rendered as chips
 *   3. Tool call display — collapsed Tool block (expandable)
 */

import { useRef, useEffect, useState } from "react";
import type { DisplayMessage, ToolCallDisplay, TraceToolCall } from "@/components/lab/types";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/chat/layout/markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Wrench, Zap, CheckCircle2, XCircle, Clock } from "lucide-react";

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
// Chain of Thought — shows all steps with reasoning trace
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status?: "ok" | "error" | "skipped" }) {
  if (status === "error") return <XCircle className="size-3 text-red-400 shrink-0" />;
  if (status === "ok") return <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />;
  return <Clock className="size-3 text-amber-400/60 shrink-0" />;
}

function TraceToolCallRow({ tc }: { tc: TraceToolCall }) {
  const isLlm = tc.tool === "llm_invoke";
  return (
    <div className="flex items-start gap-1.5 pl-2 border-l border-amber-200/40">
      <StatusIcon status={tc.status} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-mono text-[10px] text-amber-700/80">
          {isLlm ? `${tc.tool} (${tc.model ?? "?"}, prompt: ${tc.prompt ?? "?"})` : tc.tool}
        </span>
        {tc.result_count !== undefined && (
          <span className="text-[9px] text-muted-foreground/60">{tc.result_count} results</span>
        )}
        {tc.checked !== undefined && (
          <span className="text-[9px] text-muted-foreground/60">
            {tc.passed}/{tc.checked} verified{tc.removed ? `, ${tc.removed} removed` : ""}
          </span>
        )}
        {tc.error && (
          <span className="text-[9px] text-red-400/80 break-all">{tc.error}</span>
        )}
      </div>
    </div>
  );
}

interface ChainOfThoughtProps {
  toolCalls: ToolCallDisplay[];
  compact?: boolean;
}

function ChainOfThought({ toolCalls, compact }: ChainOfThoughtProps) {
  const [open, setOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const summary = toolCalls
    .map((tc) => tc.name.charAt(0).toUpperCase() + tc.name.slice(1))
    .join(" → ");

  return (
    <div className={cn("mb-2 rounded-lg border border-amber-200/50 bg-amber-50/30 px-3 py-2", compact && "px-2 py-1.5")}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        <Zap className="size-3 text-amber-500 shrink-0" />
        <span className={cn("font-semibold text-amber-700 shrink-0", compact ? "text-[10px]" : "text-xs")}>
          Chain of Thought
        </span>
        {!open && (
          <span className={cn("text-amber-600/70 truncate flex-1", compact ? "text-[10px]" : "text-xs")}>
            {summary}
          </span>
        )}
        {open ? (
          <ChevronDown className="size-3 ml-auto shrink-0 text-amber-500" />
        ) : (
          <ChevronRight className="size-3 ml-auto shrink-0 text-amber-500" />
        )}
      </button>

      {/* Step list */}
      {open && (
        <div className="mt-2 flex flex-col gap-1">
          {toolCalls.map((tc, idx) => {
            const hasTrace = !!tc.trace;
            const isExpanded = expandedStep === tc.id;
            const hasToolCalls = (tc.trace?.tool_calls?.length ?? 0) > 0;
            return (
              <div key={tc.id} className="flex flex-col gap-0.5">
                {/* Step header */}
                <button
                  onClick={() => hasTrace && setExpandedStep(isExpanded ? null : tc.id)}
                  className={cn(
                    "flex items-start gap-2 w-full text-left rounded px-1.5 py-1",
                    hasTrace ? "hover:bg-amber-100/40 cursor-pointer" : "cursor-default"
                  )}
                >
                  <span className={cn("shrink-0 font-mono text-amber-400/60 w-4 mt-0.5", compact ? "text-[10px]" : "text-xs")}>
                    {idx + 1}.
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon status={tc.trace?.status} />
                      <span className={cn("font-medium text-amber-800", compact ? "text-[10px]" : "text-xs")}>
                        {tc.name}
                      </span>
                      {hasTrace && (
                        hasToolCalls
                          ? <span className="text-[9px] text-amber-500/50 ml-auto">{isExpanded ? "▲" : "▼"} {tc.trace!.tool_calls!.length} tool{tc.trace!.tool_calls!.length !== 1 ? "s" : ""}</span>
                          : null
                      )}
                    </div>
                    {/* Inline thought — always shown */}
                    {tc.trace?.thought && (
                      <span className={cn("text-amber-700/70 leading-snug", compact ? "text-[9px]" : "text-[10px]")}>
                        {tc.trace.thought}
                      </span>
                    )}
                    {/* Action args for frontend actions */}
                    {tc.kind === "action" && tc.args && tc.args !== "{}" && !hasTrace && (
                      <span className={cn("font-mono text-muted-foreground/60 break-all", compact ? "text-[9px]" : "text-[10px]")}>
                        {tc.args.length > 120 ? tc.args.slice(0, 120) + "…" : tc.args}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded tool call details */}
                {isExpanded && hasToolCalls && (
                  <div className="ml-6 flex flex-col gap-1 mb-0.5">
                    {tc.trace!.tool_calls!.map((ttc, i) => (
                      <TraceToolCallRow key={i} tc={ttc} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
// Tool block (expandable)
// ---------------------------------------------------------------------------

interface ToolBlockProps {
  tc: ToolCallDisplay;
  compact?: boolean;
}

function ToolBlock({ tc, compact }: ToolBlockProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("rounded border bg-muted/40 overflow-hidden", compact ? "text-[10px]" : "text-xs")}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-muted/60 transition-colors text-left"
      >
        <Wrench className="size-3 text-muted-foreground shrink-0" />
        <span className="font-mono text-muted-foreground truncate">{tc.name}</span>
        {open ? (
          <ChevronDown className="size-3 ml-auto shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 ml-auto shrink-0 text-muted-foreground" />
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
    <div className={cn("flex flex-col gap-3 p-4 overflow-y-auto flex-1 min-h-0", compact && "p-2 gap-2")}>
      {!compact && (
        <div className="flex items-center gap-2 pb-2 border-b mb-1 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Atlas Custom
          </span>
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
            CoT + Citations + Tools
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
              <Card className={cn("max-w-[80%] bg-accent/10 border-accent/40", compact && "text-xs")}>
                <CardContent className={cn("whitespace-pre-wrap", compact ? "px-2 py-1.5" : "px-3 py-2")}>
                  {msg.content}
                </CardContent>
              </Card>
            </div>
          );
        }

        return (
          <div key={msg.id} className={cn("flex flex-col gap-2", compact && "gap-1")}>
            {toolCalls.length > 0 && (
              <ChainOfThought toolCalls={toolCalls} compact={compact} />
            )}

            {toolCalls.filter((tc) => tc.kind === "action").length > 0 && !compact && (
              <div className="flex flex-col gap-1 mb-1">
                {toolCalls.filter((tc) => tc.kind === "action").map((tc) => (
                  <ToolBlock key={tc.id} tc={tc} compact={compact} />
                ))}
              </div>
            )}

            {msg.content && (
              <div className={cn("text-foreground rounded-lg p-3", compact && "text-xs p-2")}>
                <Markdown content={msg.content} />
              </div>
            )}

            {citations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {citations.map((c) => (
                  <CitationChip key={c} label={c} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs animate-pulse">Analysing evidence…</span>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
