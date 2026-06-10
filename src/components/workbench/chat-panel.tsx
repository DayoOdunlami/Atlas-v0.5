"use client";

/**
 * ChatPanel — live workbench chat using assistant-ui ThreadPrimitive.
 *
 * Layout (like Claude / ChatGPT / Cursor):
 *   ┌─────────────────────┐
 *   │ Header (fixed)      │
 *   │ Artifact card       │
 *   ├─────────────────────┤
 *   │ Messages (scroll)   │  ← flex-1 overflow-y-auto
 *   ├─────────────────────┤
 *   │ Suggestions chips   │  ← shrink-0
 *   │ PromptInput (fixed) │  ← shrink-0, always visible
 *   └─────────────────────┘
 *
 * Transport: WorkbenchRuntimeProvider (assistant-ui) →
 *            LangGraph CLI /api/lg proxy → workbench graph
 *
 * The static echo handler is removed. Messages stream from the real agent.
 * When the LangGraph server is not running, assistant-ui shows an error state.
 */

import * as React from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useComposerRuntime,
  useMessage,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import {
  ArrowUp,
  Square,
  Plus,
  FileText,
  Lightbulb,
  Bot,
  Compass,
  Search,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CitationList } from "@/components/workbench/citation-popover";

// ---------------------------------------------------------------------------
// Suggested questions — workbench-aware (will be model-driven later)
// ---------------------------------------------------------------------------

// Suggestions cover all routes: explain, search, explore, economic_analysis
const SUGGESTIONS = [
  "Why is confidence capped?",
  "Show the largest gaps",
  "Find corpus evidence for this match",
  "What other transport tech projects are in the corpus?",
  "Run an economic case analysis",
  "How would this match be defended?",
];

// ---------------------------------------------------------------------------
// Artifact summary card (top of panel)
// ---------------------------------------------------------------------------

function ArtifactSummaryCard() {
  const { model, session } = useWorkbench();
  const spine = model.decision_spine;

  return (
    <div className="mx-3 mb-2 rounded-lg border border-border bg-background p-3 space-y-1.5">
      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
        {model.source_object.title}
      </p>
      <p className="text-xs text-muted-foreground line-clamp-1">
        → {model.target_object.title}
      </p>
      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
        <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {model.canonical_question_id}
        </span>
        <span className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
          {spine.confidence_tier}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
          {Math.round(spine.score * 100)}%
        </span>
      </div>
      {session.matchId && (
        <p className="text-[10px] text-muted-foreground/50 font-mono">
          match:{session.matchId.slice(0, 8)}…
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message components (used by ThreadPrimitive.Messages)
// ---------------------------------------------------------------------------

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end mb-3 group">
      <div className="max-w-[88%] bg-foreground text-background rounded-2xl rounded-br-sm px-3 py-2 text-xs leading-relaxed">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  const message = useMessage();
  // "running" status means the message is actively streaming
  const isRunning =
    (message.status as { type?: string } | undefined)?.type === "running";

  return (
    <MessagePrimitive.Root className="flex gap-2 mb-3 group">
      {/* Avatar */}
      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-indigo-600 mt-0.5">
        <Bot className="w-3 h-3" />
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0 rounded-lg px-3 py-2 text-xs bg-background border border-border leading-relaxed">
        {/* MessagePrimitive.Content renders each message part.
            MarkdownTextPrimitive reads from the part context — cast through unknown
            to satisfy the TextMessagePartComponent generic constraint. */}
        <MessagePrimitive.Content
          components={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Text: MarkdownTextPrimitive as any,
          }}
        />

        {/* Streaming typing dots */}
        {isRunning && (
          <span className="inline-flex items-center gap-1 mt-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        )}
      </div>
    </MessagePrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-xs font-semibold text-foreground">Atlas Copilot</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px] leading-relaxed">
          Ask anything — evidence gaps, corpus search, economic case, or explore the full CPC corpus.
        </p>
      </div>
      {/* Mode pills */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {(["Explain", "Search", "Explore", "Economic"] as const).map((m) => (
          <span
            key={m}
            className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggestion chips — click to fill composer
// ---------------------------------------------------------------------------

function SuggestionChip({ text }: { text: string }) {
  const composer = useComposerRuntime();

  const handleClick = React.useCallback(() => {
    composer.setText(text);
    // Focus the composer input after setting text
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "[data-workbench-composer] textarea",
    );
    textarea?.focus();
  }, [composer, text]);

  return (
    <button
      onClick={handleClick}
      className="text-[10px] rounded-full border border-border px-2.5 py-1 bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors whitespace-nowrap"
    >
      {text}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Composer — PromptInput shell over ComposerPrimitive
// ---------------------------------------------------------------------------

function WorkbenchComposer() {
  return (
    <ComposerPrimitive.Root className="w-full" data-workbench-composer="">
      <div
        className={cn(
          "rounded-xl border border-input bg-background",
          "focus-within:ring-1 focus-within:ring-ring transition-colors",
          "shadow-sm",
        )}
      >
        {/* Textarea */}
        <ComposerPrimitive.Input
          rows={1}
          placeholder="Ask about this match, search the corpus, or explore CPC projects…"
          className={cn(
            "w-full resize-none bg-transparent px-3 pt-3 pb-1 text-xs",
            "placeholder:text-muted-foreground outline-none",
            "min-h-[40px] max-h-[120px] overflow-y-auto",
            "disabled:cursor-not-allowed",
          )}
          autoFocus={false}
        />

        {/* Action row */}
        <div className="flex items-center justify-end gap-1.5 px-2 pb-2">
          {/* Stop button (shown while streaming) */}
          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel asChild>
              <button
                className={cn(
                  "flex items-center justify-center rounded-lg w-7 h-7",
                  "bg-foreground text-background",
                  "hover:bg-foreground/80 transition-colors",
                )}
                aria-label="Stop"
              >
                <Square className="w-3 h-3 fill-background" />
              </button>
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>

          {/* Send button (shown when idle) */}
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send asChild>
              <button
                className={cn(
                  "flex items-center justify-center rounded-lg w-7 h-7",
                  "bg-foreground text-background",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "hover:bg-foreground/80 transition-colors",
                )}
                aria-label="Send"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel — root
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CitationStrip — M1.3: shows corpus citations from last search/explore turn
// ---------------------------------------------------------------------------

function CitationStrip() {
  const { lastCitations, lastRoute } = useWorkbench();
  if (!lastCitations.length) return null;
  if (lastRoute !== "search" && lastRoute !== "explore") return null;

  return (
    <div className="px-3 py-2 shrink-0 border-b border-border bg-muted/30">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
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
        size="xs"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route mode indicator — shows which route the agent last used
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
        "inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border",
        def.className,
      )}
      title={`Last agent route: ${route}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {def.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel — root
// ---------------------------------------------------------------------------

export function ChatPanel() {
  const { resetSession, session, lastRoute } = useWorkbench();

  return (
    <ThreadPrimitive.Root className="flex flex-col h-full border-r border-border bg-muted/20">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0">
        <span className="text-sm font-medium">Atlas Copilot</span>

        {/* Running state */}
        <ThreadPrimitive.If running>
          <span className="ml-1 inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
            thinking
          </span>
        </ThreadPrimitive.If>

        {/* Idle: last route chip OR live/demo */}
        <ThreadPrimitive.If running={false}>
          {lastRoute ? (
            <RouteModeChip route={lastRoute} />
          ) : (
            <span
              className={cn(
                "ml-1 inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border",
                session.matchId
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800"
                  : "bg-muted text-muted-foreground border-border",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full inline-block",
                  session.matchId ? "bg-green-500" : "bg-amber-400",
                )}
              />
              {session.matchId ? "live" : "demo"}
            </span>
          )}
        </ThreadPrimitive.If>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={resetSession}
          title="Start a new chat"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </Button>
      </div>

      {/* ── Current artifact ── */}
      <div className="pt-2 pb-1 shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-1.5">
          <FileText className="w-3 h-3 text-muted-foreground/70" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Current artifact
          </span>
        </div>
        <ArtifactSummaryCard />
      </div>

      <div className="mx-3 border-t border-border shrink-0" />

      {/* ── Messages — scrollable, flex-1 ── */}
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto min-h-0 overscroll-contain px-3 py-3">
        <ThreadPrimitive.Empty>
          <EmptyState />
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      <div className="mx-3 border-t border-border shrink-0" />

      {/* ── Corpus citations strip (search / explore routes) M1.3 ── */}
      <CitationStrip />

      {/* ── Suggested questions ── */}
      <ThreadPrimitive.Empty>
        <div className="pt-2 pb-1 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            <Lightbulb className="w-3 h-3 text-muted-foreground/70" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Suggested
            </span>
          </div>
          <div className="px-3 flex flex-wrap gap-1.5 pb-2">
            {SUGGESTIONS.map((s) => (
              <SuggestionChip key={s} text={s} />
            ))}
          </div>
        </div>
      </ThreadPrimitive.Empty>

      {/* ── Pinned input — always visible ── */}
      <div className="px-3 pb-3 pt-2 shrink-0">
        <WorkbenchComposer />
      </div>

    </ThreadPrimitive.Root>
  );
}
