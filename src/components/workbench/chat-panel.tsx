"use client";

// ChatPanel — stream-ready chat surface using prompt-kit primitives.
//
// State source: WorkbenchContext.messages (static placeholder until backend wired).
// Framework: TBD (CopilotKit + AG-UI). onSubmit logs to console until wired.
//
// When backend is wired:
//   1. Replace onSubmit with CopilotKit sendMessage / AG-UI emit
//   2. Replace messages[] with live useCoAgent / useCopilotChat output
//   3. Remove INITIAL_MESSAGES from WorkbenchContext
//   4. Populate recentSessions from Supabase atlas.workbench_sessions

import * as React from "react";
import { FileText, Lightbulb, Plus, ArrowUp } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import {
  ChatContainerRoot,
  ChatContainerContent,
} from "@/components/prompt-kit/chat-container";
import {
  Message,
  MessageContent,
} from "@/components/prompt-kit/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
  PromptInputSubmit,
} from "@/components/prompt-kit/prompt-input";
import { ScrollButton } from "@/components/prompt-kit/scroll-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nanoid } from "nanoid";

// ---------------------------------------------------------------------------
// Suggested questions — will be driven by the active render model later
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "Why is confidence capped?",
  "Show largest gaps",
  "Open Defend view",
  "What's the next action?",
  "Which claims need evidence?",
];

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5">
      <span className="text-muted-foreground/70">{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
    </div>
  );
}

function ArtifactSummaryCard() {
  const { model, session } = useWorkbench();
  const spine = model.decision_spine;

  return (
    <div className="mx-3 mb-2 rounded-md border border-border bg-background p-3 space-y-1.5">
      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
        {model.source_object.title}
      </p>
      <p className="text-xs text-muted-foreground line-clamp-1">
        Target: {model.target_object.title}
      </p>
      <div className="flex items-center gap-2 pt-0.5">
        <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {model.canonical_question_id}
        </span>
        <span className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
          {spine.confidence_tier}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {Math.round(spine.score * 100)}%
        </span>
      </div>
      <div className="flex items-center gap-1 pt-0.5">
        <span className="text-[10px] text-muted-foreground/60 font-mono">
          {session.matchId
            ? `match:${session.matchId.slice(0, 8)}…`
            : "demo mode"}
        </span>
        {session.sessionId && (
          <span className="text-[10px] text-muted-foreground/60 font-mono ml-1">
            · thread:{session.sessionId.slice(0, 8)}…
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ChatPanel() {
  const { messages, addMessage, resetSession, session } = useWorkbench();
  const [prompt, setPrompt] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  // onSubmit is intentionally inert until CopilotKit / AG-UI is wired.
  // Replace this entire handler at backend wiring time.
  const handleSubmit = React.useCallback(() => {
    const text = prompt.trim();
    if (!text || isLoading) return;

    // Add user message to context
    addMessage({
      id: nanoid(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    });
    setPrompt("");

    // Placeholder echo — remove when backend is wired
    setIsLoading(true);
    setTimeout(() => {
      addMessage({
        id: nanoid(),
        role: "assistant",
        content:
          "_(Backend not yet wired. This is a placeholder echo.)_ " +
          "When CopilotKit + LangGraph are connected, the Atlas agent will respond here.",
        timestamp: new Date().toISOString(),
      });
      setIsLoading(false);
    }, 800);
  }, [prompt, isLoading, addMessage]);

  const handleSuggestion = React.useCallback(
    (s: string) => {
      setPrompt(s);
    },
    [],
  );

  return (
    <div className="flex flex-col h-full border-r border-border bg-muted/20">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0">
        <span className="text-sm font-medium">Atlas Copilot</span>
        <span
          className={cn(
            "ml-1 inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5",
            session.sessionId
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full inline-block",
              session.sessionId ? "bg-green-500" : "bg-amber-400",
            )}
          />
          {session.sessionId ? "live" : "static"}
        </span>
        <div className="flex-1" />
        {/* New Chat button — resets session/messages */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={resetSession}
          title="Start a new chat (clears messages and thread)"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </Button>
      </div>

      {/* ── Current artifact ── */}
      <div className="pt-2 pb-1 shrink-0">
        <SectionLabel icon={<FileText className="w-3 h-3" />} label="Current artifact" />
        <ArtifactSummaryCard />
      </div>

      <div className="mx-3 border-t border-border shrink-0" />

      {/* ── Messages (scrollable) ── */}
      <div className="flex-1 overflow-hidden relative">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent className="px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No messages yet. Ask anything about this artifact.
              </p>
            )}
            {messages.map((msg) => (
              <Message
                key={msg.id}
                from={msg.role}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" && "flex-row-reverse",
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5",
                    msg.role === "assistant"
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-foreground text-background",
                  )}
                >
                  {msg.role === "assistant" ? "A" : "U"}
                </div>

                {/* Bubble */}
                <div
                  className={cn(
                    "flex-1 min-w-0 rounded-lg px-3 py-2 text-xs",
                    msg.role === "assistant"
                      ? "bg-background border border-border"
                      : "bg-foreground text-background",
                  )}
                >
                  <MessageContent
                    markdown={msg.role === "assistant"}
                    className={cn(
                      "text-xs leading-relaxed",
                      msg.role === "user" && "text-background",
                    )}
                  >
                    {msg.content}
                  </MessageContent>
                </div>
              </Message>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <Message from="assistant" className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-indigo-600 mt-0.5">
                  A
                </div>
                <div className="bg-background border border-border rounded-lg px-3 py-2 flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </Message>
            )}
          </ChatContainerContent>

          {/* Scroll-to-bottom button */}
          <div className="absolute bottom-2 right-2">
            <ScrollButton />
          </div>
        </ChatContainerRoot>
      </div>

      <div className="mx-3 border-t border-border shrink-0" />

      {/* ── Suggested questions ── */}
      <div className="pt-2 pb-2 shrink-0">
        <SectionLabel icon={<Lightbulb className="w-3 h-3" />} label="Suggested" />
        <div className="px-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              className="text-[10px] rounded-full border border-border px-2.5 py-1 bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Prompt input ── */}
      <div className="px-3 pb-3 shrink-0">
        <PromptInput
          value={prompt}
          onValueChange={setPrompt}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          className="shadow-sm"
        >
          <PromptInputTextarea
            placeholder="Ask about this artifact…"
            className="text-xs min-h-[36px]"
          />
          <PromptInputActions className="justify-end pb-1.5 pr-1.5">
            <PromptInputAction tooltip="Send (Enter)">
              <PromptInputSubmit>
                <ArrowUp className="w-3.5 h-3.5" />
              </PromptInputSubmit>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
        <p className="text-[10px] text-center text-muted-foreground/50 mt-1.5">
          Responses are placeholder until backend is wired
        </p>
      </div>
    </div>
  );
}
