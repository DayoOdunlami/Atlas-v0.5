"use client";

/**
 * Panel D — Atlas Custom renderer.
 *
 * Visual design inspired by ai-elements ChainOfThought patterns, adapted for
 * our CopilotKit/LangGraph data shape (no AI SDK dependency).
 *
 * Three Atlas-specific features on top of a standard message thread:
 *   1. Chain of Thought — imported from shared chain-of-thought.tsx
 *   2. Inline citations — UUID / [N] patterns rendered as chips
 *   3. Tool call display — collapsed Tool block (expandable)
 */

import { useRef, useEffect, useState } from "react";
import type { DisplayMessage, ToolCallDisplay } from "@/components/lab/types";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/chat/layout/markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { ChainOfThought } from "@/components/lab/chain-of-thought";

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
        const isStreaming = msg.id === "__streaming__";

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
                defaultOpen={isStreaming}
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

            {/* Message content — skip for streaming sentinel (empty content) */}
            {msg.content && !isStreaming && (
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
