"use client";

/**
 * OrchestratorChatPanel — CopilotKit chat for the ADR-0001 orchestrator path.
 *
 * Replaces assistant-ui ThreadPrimitive when NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1=true.
 * Sends messages to /api/copilotkit → Python /workbench orchestrator graph.
 */

import * as React from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";
import { FileText, Lightbulb, Plus } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const CANONICAL_SUGGESTIONS = [
  "What evidence does CPC have in smart mobility that would transfer to the Innovate UK Smart City Challenge?",
  "What evidence gaps does CPC have in smart mobility?",
  "Which CPC projects are closest to a smart mobility funding call?",
];

const DEEP_SIGNAL =
  /\b(business case|investment brief|five case|full brief|npv|comprehensive|detailed analysis)\b/i;

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

export function OrchestratorChatPanel() {
  const { session, resetSession, cqId, setReasoningSteps } = useWorkbench();
  const { appendMessage, isLoading } = useCopilotChat();
  const isHome = cqId === "cq.home";
  const [pendingDeep, setPendingDeep] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isLoading) {
      setReasoningSteps([
        { label: "Orchestrator running", status: "active" },
      ]);
    } else {
      setReasoningSteps([]);
    }
  }, [isLoading, setReasoningSteps]);

  async function sendSuggestion(text: string) {
    if (DEEP_SIGNAL.test(text)) {
      setPendingDeep(text);
      return;
    }
    await appendMessage(
      new TextMessage({ role: MessageRole.User, content: text }),
    );
  }

  async function confirmDeep() {
    if (!pendingDeep) return;
    const text = pendingDeep;
    setPendingDeep(null);
    await appendMessage(
      new TextMessage({ role: MessageRole.User, content: text }),
    );
  }

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-semibold text-foreground">Atlas Workbench</span>
        <span className="ml-1 inline-flex items-center gap-1.5 text-[11px] rounded px-2 py-0.5 border font-medium bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
          orchestrator
        </span>
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

      {!isHome && (
        <>
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
        </>
      )}

      {pendingDeep && (
        <div className="px-4 py-3 shrink-0">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3 text-sm">
            <p className="font-medium text-amber-900">
              This looks like a deep-research query. Proceed with full analysis?
            </p>
            <p className="text-amber-800 text-xs line-clamp-2">{pendingDeep}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmDeep}
                className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium"
              >
                Go ahead
              </button>
              <button
                type="button"
                onClick={() => setPendingDeep(null)}
                className="px-3 py-1.5 rounded text-amber-700 text-xs hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CopilotKit chat */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <CopilotChat
          className="h-full"
          labels={{
            title: session.matchId ? "Match workbench" : "Ask Atlas",
            initial: isHome
              ? "Ask about the CPC corpus, evidence gaps, or transfer fit."
              : "Ask about this match — I'll update the canvas with structured blocks.",
          }}
        />
      </div>

      {/* Suggestions */}
      <div className="pt-2 pb-1 shrink-0 border-t border-border">
        <div className="flex items-center gap-1.5 px-4 py-1">
          <Lightbulb className="w-3.5 h-3.5 text-muted-foreground/70" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Suggested
          </span>
        </div>
        <div className="px-4 flex flex-col gap-1.5 pb-3">
          {CANONICAL_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sendSuggestion(s)}
              className={cn(
                "text-left text-xs rounded-md border border-border/80 px-2.5 py-2",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
