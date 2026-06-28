"use client";

import { useMemo, useState } from "react";

import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

export type AtlasReasoningStep = {
  node?: string;
  thought: string;
  evidence_count?: number;
};

const NODE_LABELS: Record<string, string> = {
  prepare: "Understand",
  route: "Route",
  gather: "Evidence",
  judgement: "Synthesise",
  complete: "Ready",
};

function stepLabel(step: AtlasReasoningStep, idx: number): string {
  if (step.thought?.trim()) return step.thought.trim();
  const node = step.node ?? "";
  if (node && NODE_LABELS[node]) return NODE_LABELS[node];
  return `Step ${idx + 1}`;
}

export function CanvasThinking({
  steps,
  active,
  stage,
  partialCanvas,
  defaultCollapsed = true,
}: {
  steps: AtlasReasoningStep[];
  active: boolean;
  stage?: string | null;
  partialCanvas?: boolean;
  /** When true, step list starts folded — headline stays visible while active. */
  defaultCollapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const visible = steps.filter((s) => s.thought?.trim());
  const last = visible[visible.length - 1];
  const headline = useMemo(() => {
    if (last) return stepLabel(last, visible.length - 1);
    if (stage === "gather") return "Gathering corpus evidence…";
    if (stage === "judgement") return "Reasoning the answer…";
    return "Atlas is thinking…";
  }, [last, stage, visible.length]);

  const showSteps = visible.length > 0 && (expanded || !active);
  const canToggle = visible.length > 0;

  if (!active && visible.length === 0) return null;

  return (
    <div
      data-testid="canvas-thinking"
      className="mb-6 rounded-lg border px-4 py-3"
      style={{
        borderColor: partialCanvas ? T.corpus : T.rule,
        background: partialCanvas ? T.corpusWash : "#F8F6F1",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={
            active ? "atlas-pulse-dot inline-block h-2 w-2 rounded-full" : "inline-block h-2 w-2 rounded-full"
          }
          style={{ background: active ? T.corpus : "#8FA98C" }}
          aria-hidden
        />
        <span
          className="uppercase"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 9,
            letterSpacing: "0.12em",
            color: T.inkFaint,
          }}
        >
          {active ? "Chain of thought" : "Turn complete"}
          {stage ? ` · ${stage}` : ""}
        </span>
        {canToggle ? (
          <button
            type="button"
            className="ml-auto cursor-pointer border-none bg-transparent p-0"
            style={{
              fontFamily: atlasFont.mono,
              fontSize: 9,
              color: T.corpus,
              letterSpacing: "0.06em",
            }}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={showSteps}
          >
            {showSteps ? "Hide steps" : "Show steps"}
          </button>
        ) : null}
      </div>

      <p
        className={showSteps ? "mb-3" : "mb-0"}
        style={{
          fontFamily: atlasFont.serif,
          fontSize: 18,
          lineHeight: 1.35,
          color: T.ink,
        }}
      >
        {headline}
      </p>

      {showSteps ? (
        <ol className="space-y-2 border-t pt-3" style={{ borderColor: T.ruleSoft }}>
          {visible.map((step, i) => {
            const isLast = i === visible.length - 1;
            const done = !active || i < visible.length - 1;
            return (
              <li key={`${step.node ?? "step"}-${i}`} className="flex items-start gap-2.5">
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: isLast && active ? T.corpus : done ? "#8FA98C" : T.inkFaint,
                    opacity: isLast && active ? 1 : done ? 0.85 : 0.45,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    style={{
                      fontFamily: atlasFont.sans,
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      color: isLast && active ? T.ink : T.inkSoft,
                    }}
                  >
                    {stepLabel(step, i)}
                    {step.evidence_count != null ? (
                      <span style={{ color: T.inkFaint }}> · {step.evidence_count} objects</span>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : active && visible.length === 0 ? (
        <p style={{ fontFamily: atlasFont.mono, fontSize: 11, color: T.inkFaint }}>
          {stage === "gather"
            ? "Gathering corpus evidence…"
            : stage === "judgement" || stage === "spine"
              ? "Synthesising answer…"
              : "Running turn — canvas may take 30–60s before the first trace step…"}
        </p>
      ) : null}
    </div>
  );
}

/** Last trace line for the chat rail progress strip. */
export function latestReasoningProgress(steps: AtlasReasoningStep[]): string | null {
  const visible = steps.filter((s) => s.thought?.trim());
  const last = visible[visible.length - 1];
  if (!last) return null;
  return stepLabel(last, visible.length - 1);
}
