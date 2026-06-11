"use client";

// DemoChatPanel — renders the canned transcript directly from WorkbenchContext.
//
// The live ChatPanel relies on assistant-ui's ThreadPrimitive, which is bound
// to a runtime. In demo mode we don't mount a runtime, so we render messages
// directly from `messages` (seeded by initialMessages on the provider).
//
// Density: this is the reference implementation of the world-class density
// pass. The live ChatPanel should converge to these sizes once the live agent
// flow is fully tested.
//
//   Base font:        14px  (text-sm)
//   Labels:           11px  (text-[11px]) with uppercase tracking
//   Headers:          15px  (text-[15px]) semibold
//   Suggestion chip:  13px  (text-[13px])
//   Composer:         14px  (text-sm)
//   Block padding:    px-4 py-3
//   Max prose width:  72ch  (max-w-[72ch])

import * as React from "react";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import type { WorkbenchChatMessage } from "@/lib/workbench/workbench-context";
import { cn } from "@/lib/utils";
import { Bot, FileText, Lightbulb, Compass, Search, Sparkles, MessageSquare, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { CitationList } from "@/components/workbench/citation-popover";

// ---------------------------------------------------------------------------
// Artifact summary card — bumped from text-xs to text-sm for readability
// ---------------------------------------------------------------------------

function ArtifactSummaryCard() {
  const { model, session } = useWorkbench();
  const spine = model.decision_spine;

  return (
    <div className="mx-4 mb-2 rounded-lg border border-border bg-background p-3 space-y-1.5">
      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
        {model.source_object.title}
      </p>
      <p className="text-xs text-muted-foreground line-clamp-1">
        → {model.target_object.title}
      </p>
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {model.canonical_question_id}
        </span>
        <span className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
          {spine.confidence_tier}
        </span>
        <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
          {Math.round(spine.score * 100)}%
        </span>
      </div>
      {session.matchId && (
        <p className="text-[11px] text-muted-foreground/60 font-mono">
          match:{session.matchId.slice(0, 8)}…
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message components — styled to match a world-class chat surface
// ---------------------------------------------------------------------------

function UserBubble({ message }: { message: WorkbenchChatMessage }) {
  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[85%] bg-foreground text-background rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed">
        {message.content}
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: WorkbenchChatMessage }) {
  const [showReasoning, setShowReasoning] = React.useState(false);

  return (
    <div className="flex gap-2.5 mb-4 group">
      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div
          className={cn(
            "rounded-lg px-3.5 py-2.5 text-sm bg-background border border-border leading-relaxed",
            "max-w-[72ch] prose prose-sm dark:prose-invert",
            "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
            "[&_strong]:font-semibold [&_strong]:text-foreground",
            "[&_ul]:my-1.5 [&_ul]:pl-5",
            "[&_li]:my-0.5",
            "[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px]",
          )}
        >
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {/* Reasoning trace — collapsible */}
        {message.reasoning && (
          <button
            type="button"
            onClick={() => setShowReasoning((v) => !v)}
            className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>
              {showReasoning ? "Hide" : "Show"} reasoning
              {message.reasoning.duration
                ? ` · ${(message.reasoning.duration / 1000).toFixed(1)}s`
                : ""}
            </span>
          </button>
        )}
        {showReasoning && message.reasoning && (
          <div className="text-[12px] text-muted-foreground bg-muted/40 border border-border rounded-md px-3 py-2 leading-relaxed max-w-[72ch]">
            {message.reasoning.content}
          </div>
        )}

        {/* Inline citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.citations.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 text-[11px] rounded border border-border bg-muted/40 px-1.5 py-0.5 text-muted-foreground"
                title={c.title}
              >
                <FileText className="w-3 h-3" />
                <span className="truncate max-w-[200px]">{c.title}</span>
                {typeof c.score === "number" && (
                  <span className="tabular-nums opacity-70">
                    {Math.round(c.score * 100)}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Citation strip — same shape as live mode but bigger text + padding
// ---------------------------------------------------------------------------

function CitationStrip() {
  const { lastCitations, lastRoute } = useWorkbench();
  if (!lastCitations.length) return null;
  if (lastRoute !== "search" && lastRoute !== "explore") return null;

  return (
    <div className="px-4 py-2.5 shrink-0 border-b border-border bg-muted/30">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {lastRoute === "explore" ? "Corpus results" : "Evidence sources"} ({lastCitations.length})
      </p>
      <CitationList
        citations={lastCitations.map((c) => ({
          id: c.id,
          title: c.title,
          organisation: c.organisation,
          score: c.score,
          relevanceNote: c.relevanceNote,
          schema: "atlas" as const,
        }))}
        maxVisible={6}
        size="sm"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route mode chip — bumped to readable size
// ---------------------------------------------------------------------------

const ROUTE_LABELS: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  explain:          { label: "Explain",  icon: MessageSquare, className: "bg-muted text-muted-foreground border-border" },
  search:           { label: "Search",   icon: Search,        className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" },
  explore:          { label: "Explore",  icon: Compass,       className: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800" },
  propose:          { label: "Propose",  icon: Sparkles,      className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
  economic_analysis:{ label: "Economic", icon: Sparkles,      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" },
  conversational:   { label: "Chat",     icon: MessageSquare, className: "bg-muted text-muted-foreground border-border" },
};

function RouteModeChip({ route }: { route: string | null }) {
  if (!route) return null;
  const def = ROUTE_LABELS[route] ?? ROUTE_LABELS.explain;
  const Icon = def.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] rounded px-2 py-0.5 border font-medium",
        def.className,
      )}
      title={`Last agent route: ${route}`}
    >
      <Icon className="w-3 h-3" />
      {def.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DemoChatPanel — root
// ---------------------------------------------------------------------------

export function DemoChatPanel() {
  const { messages, lastRoute } = useWorkbench();

  return (
    <div className="flex flex-col h-full border-r border-border bg-muted/20">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background shrink-0">
        <span className="text-[15px] font-semibold">Atlas Copilot</span>
        <RouteModeChip route={lastRoute} />

        <span className="ml-1 inline-flex items-center gap-1 text-[11px] rounded px-2 py-0.5 border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          demo
        </span>

        <div className="flex-1" />
      </div>

      {/* ── Current artifact ── */}
      <div className="pt-3 pb-1 shrink-0">
        <div className="flex items-center gap-1.5 px-4 py-1">
          <FileText className="w-3.5 h-3.5 text-muted-foreground/70" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Current artifact
          </span>
        </div>
        <ArtifactSummaryCard />
      </div>
      <div className="mx-4 border-t border-border shrink-0" />

      {/* ── Messages — scrollable ── */}
      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain px-4 py-3">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} message={m} />
            ) : (
              <AssistantBubble key={m.id} message={m} />
            ),
          )
        )}
      </div>

      <div className="mx-4 border-t border-border shrink-0" />

      <CitationStrip />

      {/* ── Suggested next moves ── */}
      <div className="pt-2 pb-1 shrink-0">
        <div className="flex items-center gap-1.5 px-4 py-1">
          <Lightbulb className="w-3.5 h-3.5 text-muted-foreground/70" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Try a different scenario
          </span>
        </div>
        <div className="px-4 text-[12px] text-muted-foreground/80 pb-2 max-w-[72ch] leading-relaxed">
          Use the scenario picker above the canvas to load a different
          pre-baked answer. Each scenario uses a different block type so you
          can compare visuals side-by-side.
        </div>
      </div>

      {/* ── Read-only composer — disabled in demo mode ── */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3.5 py-3 text-[13px] text-muted-foreground inline-flex items-center gap-2 w-full">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Demo composer — pick a scenario above to swap the answer</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="w-5 h-5 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground">Demo scenario empty</p>
      <p className="text-[13px] text-muted-foreground max-w-[260px] leading-relaxed">
        Pick a scenario from the picker above the canvas to load a pre-baked
        question and answer.
      </p>
    </div>
  );
}
