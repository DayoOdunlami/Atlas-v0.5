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
} from "lucide-react";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Suggested questions — workbench-aware (will be model-driven later)
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "Why is confidence capped?",
  "Show the largest gaps",
  "Which claims need evidence?",
  "What's the recommended next action?",
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
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
        <Bot className="w-4 h-4 text-indigo-500" />
      </div>
      <p className="text-xs font-medium text-foreground">Atlas Copilot</p>
      <p className="text-[11px] text-muted-foreground max-w-[180px] leading-relaxed">
        Ask anything about this match — evidence gaps, confidence, next actions.
      </p>
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
          placeholder="Ask about this artifact…"
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

export function ChatPanel() {
  const { resetSession, session } = useWorkbench();

  return (
    <ThreadPrimitive.Root className="flex flex-col h-full border-r border-border bg-muted/20">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0">
        <span className="text-sm font-medium">Atlas Copilot</span>

        {/* Live / static status dot */}
        <ThreadPrimitive.If running>
          <span className="ml-1 inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
            thinking
          </span>
        </ThreadPrimitive.If>

        <ThreadPrimitive.If running={false}>
          <span
            className={cn(
              "ml-1 inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5",
              session.matchId
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-muted text-muted-foreground",
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

      {/* ── Suggested questions ── */}
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

      {/* ── Pinned input — always visible ── */}
      <div className="px-3 pb-3 shrink-0">
        <WorkbenchComposer />
        <p className="text-[10px] text-center text-muted-foreground/40 mt-1.5">
          Start the LangGraph server to enable live responses
        </p>
      </div>

    </ThreadPrimitive.Root>
  );
}
