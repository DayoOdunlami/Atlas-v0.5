"use client";

import { useCallback, useState } from "react";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { ChartCanvas } from "@/components/atlas/composition/chart-canvas";
import { CompositionCanvas } from "@/components/atlas/composition/composition-canvas";
import { IncommensurableMagnitudes } from "@/components/atlas/recipes/incommensurable-magnitudes";
import { EvidenceGapMatrix } from "@/components/atlas/recipes/evidence-gap-matrix";
import { NetworkMap } from "@/components/atlas/recipes/network-map";
import { OpportunityList } from "@/components/atlas/recipes/opportunity-list";
import { CanvasThinking, type AtlasReasoningStep } from "@/components/atlas/shell/canvas-thinking";
import { CarriedFromBanner } from "@/components/atlas/shell/carried-from-banner";
import { ConnectionStatus } from "@/components/atlas/shell/connection-status";
import { DevOverlay, type AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import { EmptyCanvas } from "@/components/atlas/shell/empty-canvas";
import {
  CanvasSectionSkeleton,
  ProgressiveCanvasSection,
  stageAtLeast,
} from "@/components/atlas/shell/progressive-canvas-section";
import { ScopeBar } from "@/components/atlas/shell/scope-bar";
import { SoWhatRail, type ChatMessage } from "@/components/atlas/shell/so-what-rail";
import type { ShowcaseOption } from "@/components/atlas/shell/showcase-chips";
import { StatStripSubordinate } from "@/components/atlas/shell/stat-strip-subordinate";
import { VerdictHero } from "@/components/atlas/shell/verdict-hero";
import { AnswerabilityCard } from "@/components/atlas/spine/answerability-card";
import { ConfidenceCeilingBar } from "@/components/atlas/spine/confidence-ceiling-bar";
import { ProvenanceTrace } from "@/components/atlas/spine/provenance-trace";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

function renderInstrument(
  instrument: AnswerSpec["instrument"],
  onProv: (id: string) => void,
) {
  if (!instrument) return null;
  if (instrument.recipe === "IncommensurableMagnitudes") {
    return <IncommensurableMagnitudes instrument={instrument} onProv={onProv} />;
  }
  if (instrument.recipe === "NetworkMap") {
    return <NetworkMap instrument={instrument} />;
  }
  if (instrument.recipe === "EvidenceGapMatrix") {
    return <EvidenceGapMatrix instrument={instrument} />;
  }
  if (instrument.recipe === "OpportunityList") {
    return <OpportunityList instrument={instrument} />;
  }
  return null;
}

export type AtlasAnswerSurfaceProps = {
  spec: AnswerSpec | null;
  dataSource?: "brain" | "mouth" | "golden";
  onFollowUp?: (message: string) => Promise<string | void> | string | void;
  devMeta?: AtlasDevMeta | null;
  chatMessages?: ChatMessage[];
  chatPending?: boolean;
  canvasThinking?: boolean;
  reasoningTrace?: AtlasReasoningStep[];
  envelopePartial?: boolean;
  showcaseOptions?: ShowcaseOption[];
  onShowcaseSelect?: (command: string) => void;
  bootstrapQuery?: string;
  onNewSession?: () => void;
};

export function AtlasAnswerSurface({
  spec,
  dataSource = "mouth",
  onFollowUp: onFollowUpProp,
  devMeta = null,
  chatMessages,
  chatPending,
  canvasThinking = false,
  reasoningTrace = [],
  envelopePartial = false,
  showcaseOptions,
  onShowcaseSelect,
  bootstrapQuery,
  onNewSession,
}: AtlasAnswerSurfaceProps) {
  const [provId, setProvId] = useState<string | null>(null);
  const partialStage = devMeta?.partial_stage;
  const building = canvasThinking && envelopePartial;
  const showStats =
    Boolean(spec?.stats?.length) &&
    (!building || (partialStage && stageAtLeast(partialStage, "stats")));
  const showSpine =
    Boolean(spec?.verdict?.sentence) &&
    (!building || (partialStage && stageAtLeast(partialStage, "spine")));
  const showVisual =
    !building ||
    partialStage === "complete" ||
    (partialStage && stageAtLeast(partialStage, "visual"));

  const handleFollowUp = useCallback(
    async (message: string) => {
      if (onFollowUpProp) {
        return onFollowUpProp(message);
      }
      const res = await fetch("/api/atlas/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, thread_id: spec?.thread_id }),
      });
      if (!res.ok) {
        return "Could not reach Atlas brain — is the agent service running on port 8000?";
      }
      const data = (await res.json()) as { reply?: string };
      return data.reply ?? "Turn complete.";
    },
    [onFollowUpProp, spec?.thread_id],
  );

  if (!spec) {
    const firstUser = chatMessages?.find((m) => m.role === "user")?.content;
    const contextLine = firstUser
      ? `Chat-first — working on your question. Canvas composes when Atlas has enough signal.`
      : bootstrapQuery
        ? `Session ready — “${bootstrapQuery.slice(0, 72)}${bootstrapQuery.length > 72 ? "…" : ""}”`
        : "No canvas loaded — start from /atlas or ask a strategic question.";
    const emptySoWhat = {
      lookingAt: contextLine,
      oneDecision: "Company assessments and vague asks stay in chat until you narrow the lens.",
      gate: "",
      primaryAction: onNewSession ? "New session" : "",
      turn: "—",
    };
    return (
      <div
        data-testid="atlas-surface-root"
        data-dataSource={dataSource}
        className="flex min-h-screen flex-col"
        style={{ background: T.page, fontFamily: atlasFont.sans }}
      >
        {onNewSession ? (
          <div
            className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2"
            style={{ borderColor: T.rule, background: T.page }}
          >
            <ConnectionStatus devMeta={devMeta} className="relative" />
            <button
              type="button"
              onClick={onNewSession}
              className="cursor-pointer border-none bg-transparent underline"
              style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.corpus }}
            >
              New session
            </button>
          </div>
        ) : (
          <div
            className="flex shrink-0 justify-end px-4 py-2"
            style={{ borderColor: T.rule, background: T.page }}
          >
            <ConnectionStatus devMeta={devMeta} className="relative" />
          </div>
        )}
        <EmptyCanvas />
        <SoWhatRail
          soWhat={emptySoWhat}
          onFollowUp={handleFollowUp}
          chatMessages={chatMessages}
          chatPending={chatPending}
          showcaseOptions={devMeta?.showcase?.options}
          onShowcaseSelect={
            onFollowUpProp
              ? (cmd) => {
                  void handleFollowUp(cmd);
                }
              : undefined
          }
        />
        <DevOverlay meta={devMeta} dataSource={dataSource} />
      </div>
    );
  }

  return (
    <div
      data-testid="atlas-surface-root"
      data-dataSource={dataSource}
      data-mode={spec.mode}
      data-recipe={spec.instrument?.recipe ?? "none"}
      className="flex min-h-screen flex-col"
      style={{ background: T.page, fontFamily: atlasFont.sans }}
    >
      {devMeta?.zod_error ? (
        <div
          className="shrink-0 px-4 py-2 text-center"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 10,
            color: "#9A3412",
            background: "#FFF7ED",
            borderBottom: "1px solid #FDBA74",
          }}
        >
          Spec validation failed — canvas kept previous turn. See dev overlay.
        </div>
      ) : null}
      {dataSource === "mouth" && process.env.NODE_ENV === "development" ? (
        <div
          className="shrink-0 px-4 py-1.5 text-center"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 10,
            color: T.inkFaint,
            background: T.ruleSoft,
            borderBottom: `1px solid ${T.rule}`,
          }}
        >
          Mouth bootstrap — set PYTHON_AGENTS_URL in .env.local and start agent:{" "}
          <code>uvicorn agents.server:app --port 8000 --reload</code>
          {" "}(CopilotKit → atlas_v5)
        </div>
      ) : null}

      <div className="flex shrink-0 justify-end px-6 pt-2">
        <ConnectionStatus devMeta={devMeta} className="relative" />
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 items-stretch overflow-hidden px-6 py-8 lg:px-14">
        <main
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-sm shadow-lg"
          style={{ background: T.canvas }}
        >
          <ScopeBar object={spec.object} scope={spec.scope} mode={spec.mode} tier={spec.tier} />
          <ConfidenceCeilingBar tier={spec.tier} />

          <div className="relative min-h-0 flex-1 overflow-y-auto px-10 pb-10 pt-8 lg:px-12">
            <ProvenanceTrace
              provId={provId}
              provenance={spec.provenance}
              onClose={() => setProvId(null)}
              className="absolute right-4 top-4 z-20"
            />

            {spec.carriedFrom ? <CarriedFromBanner carriedFrom={spec.carriedFrom} /> : null}
            {canvasThinking ? (
              <CanvasThinking
                steps={reasoningTrace}
                active={canvasThinking}
                stage={devMeta?.turn_stage}
                partialCanvas={envelopePartial}
              />
            ) : null}
            <div
              key={`${spec.mode}-${spec.instrument?.recipe ?? "none"}-${spec.canvas?.gate_status ?? ""}-${spec.verdict?.sentence?.slice(0, 48) ?? "partial"}`}
              className="atlas-canvas-morph"
              style={{
                opacity: envelopePartial && canvasThinking ? 0.92 : 1,
                transition: "opacity 0.35s ease",
              }}
            >
              {showStats ? (
                <ProgressiveCanvasSection visible index={0} testId="progressive-stats">
                  <StatStripSubordinate
                    stats={spec.stats!}
                    onProv={setProvId}
                    animateNumbers={!building}
                  />
                </ProgressiveCanvasSection>
              ) : building ? (
                <CanvasSectionSkeleton lines={1} />
              ) : null}

              {showSpine ? (
                <>
                  <ProgressiveCanvasSection visible index={1} testId="progressive-verdict">
                    <VerdictHero verdict={spec.verdict} />
                  </ProgressiveCanvasSection>
                  {spec.blindspot ? (
                    <ProgressiveCanvasSection visible index={2} testId="progressive-blindspot">
                      <AnswerabilityCard blindspot={spec.blindspot} />
                    </ProgressiveCanvasSection>
                  ) : null}
                </>
              ) : building ? (
                <CanvasSectionSkeleton lines={3} />
              ) : null}

              {showVisual ? (
                <>
                  {spec.chart?.option ? (
                    <ProgressiveCanvasSection visible index={3} testId="progressive-chart">
                      <ChartCanvas chart={spec.chart} />
                    </ProgressiveCanvasSection>
                  ) : null}
                  {spec.canvas?.merged_markup && spec.canvas.gate_status === "pass" ? (
                    <ProgressiveCanvasSection visible index={4} testId="progressive-compose">
                      <CompositionCanvas canvas={spec.canvas} />
                    </ProgressiveCanvasSection>
                  ) : (
                    <ProgressiveCanvasSection visible index={4} testId="progressive-instrument">
                      {renderInstrument(spec.instrument, setProvId)}
                    </ProgressiveCanvasSection>
                  )}
                </>
              ) : building ? (
                <CanvasSectionSkeleton lines={2} />
              ) : null}
            </div>
          </div>

          <div
            className="flex shrink-0 gap-[18px] border-t px-10 py-3 lg:px-12"
            style={{
              fontFamily: atlasFont.mono,
              fontSize: 10,
              color: T.inkFaint,
              borderColor: "#E7E3DC",
            }}
          >
            <span>● corpus — solid, owned</span>
            <span style={{ color: T.web }}>┄ web — dashed, borrowed</span>
            <span style={{ color: T.declared }}>◇ stated by user — declared, max Indicative</span>
            <span style={{ color: T.gap }}>⌁ gap — torn, under-count</span>
          </div>
        </main>

        <SoWhatRail
          soWhat={spec.soWhat}
          initialQuery={spec.query}
          onFollowUp={handleFollowUp}
          chatMessages={chatMessages}
          chatPending={chatPending}
          showcaseOptions={showcaseOptions}
          onShowcaseSelect={onShowcaseSelect}
        />
      </div>
      <DevOverlay meta={devMeta} dataSource={dataSource} />
    </div>
  );
}
