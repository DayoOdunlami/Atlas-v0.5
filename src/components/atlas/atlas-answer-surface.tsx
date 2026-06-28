"use client";

import { useCallback, useState } from "react";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { ChartCanvas } from "@/components/atlas/composition/chart-canvas";
import { CompositionCanvas } from "@/components/atlas/composition/composition-canvas";
import { IncommensurableMagnitudes } from "@/components/atlas/recipes/incommensurable-magnitudes";
import { EvidenceGapMatrix } from "@/components/atlas/recipes/evidence-gap-matrix";
import { NetworkMap } from "@/components/atlas/recipes/network-map";
import { OpportunityList } from "@/components/atlas/recipes/opportunity-list";
import { CanvasThinking, latestReasoningProgress, type AtlasReasoningStep } from "@/components/atlas/shell/canvas-thinking";
import { CarriedFromBanner } from "@/components/atlas/shell/carried-from-banner";
import { AtlasSessionWorkspace } from "@/components/atlas/shell/atlas-session-workspace";
import { DeclaredClaimsBlock } from "@/components/atlas/shell/declared-claims-block";
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
import type { AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import type { ThreadSummary, PersistStatus } from "@/lib/atlas/thread-client";
import { chartsForRender } from "@/lib/atlas/chart-visual-policy";

import type { AtlasUxPrefs } from "@/lib/atlas/ux-preferences";

const CANVAS_SHELL =
  "flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#FBFAF7]";
const CANVAS_BODY =
  "relative min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-6 lg:px-8";

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
  collapsibleCot?: boolean;
  progressLine?: string | null;
  uxPrefs?: AtlasUxPrefs;
  onUxPrefsChange?: (patch: Partial<AtlasUxPrefs>) => void;
  turnTiming?: { elapsedMs: number | null; running: boolean };
  activeThreadId?: string | null;
  threads?: ThreadSummary[];
  threadsLoading?: boolean;
  onSelectThread?: (threadId: string) => void;
  onNewThread?: () => void;
  historyDisabled?: boolean;
  persistStatus?: PersistStatus;
  persistConfigured?: boolean;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, title: string) => void | Promise<void>;
  rehydrating?: boolean;
  onCaseFileSwot?: (message: string) => void;
  onCaseEntityAttached?: (entityId: string | null) => void;
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
  collapsibleCot = true,
  progressLine,
  uxPrefs,
  onUxPrefsChange,
  turnTiming,
  activeThreadId = null,
  threads = [],
  threadsLoading = false,
  onSelectThread,
  onNewThread,
  historyDisabled = false,
  persistStatus = "idle",
  persistConfigured = true,
  onDeleteThread,
  onRenameThread,
  rehydrating = false,
  onCaseFileSwot,
  onCaseEntityAttached,
}: AtlasAnswerSurfaceProps) {
  const [provId, setProvId] = useState<string | null>(null);
  const partialStage = devMeta?.partial_stage;
  const building = canvasThinking && envelopePartial;
  /** Skeleton spine from wide pass is not the final answer — hide until complete. */
  const judgementLocked =
    building && partialStage !== "complete" && partialStage !== undefined;
  const showStats =
    Boolean(spec?.stats?.length) &&
    (!building || (partialStage && stageAtLeast(partialStage, "stats")));
  const showSpine =
    Boolean(spec?.verdict?.sentence) && !judgementLocked;
  const showVisual = !judgementLocked && (
    !building ||
    partialStage === "complete" ||
    (partialStage && stageAtLeast(partialStage, "visual"))
  );

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
      gate: "—",
      primaryAction: onNewSession ? "New question" : "—",
      turn: "—",
    };
    return (
      <AtlasSessionWorkspace
        dataSource={dataSource}
        devMeta={devMeta}
        uxPrefs={uxPrefs}
        onUxPrefsChange={onUxPrefsChange}
        turnTiming={turnTiming}
        threads={threads}
        activeThreadId={activeThreadId}
        threadsLoading={threadsLoading}
        onSelectThread={onSelectThread}
        onNewThread={onNewThread}
        onNewSession={onNewSession}
        chatPending={chatPending}
        historyDisabled={historyDisabled}
        persistStatus={persistStatus}
        persistConfigured={persistConfigured}
        onDeleteThread={onDeleteThread}
        onRenameThread={onRenameThread}
        rehydrating={rehydrating}
        canvasPanel={
          <main className={CANVAS_SHELL} style={{ background: T.canvas }}>
            <div className={CANVAS_BODY}>
              {canvasThinking ? (
                <CanvasThinking
                  steps={reasoningTrace}
                  active={canvasThinking}
                  stage={devMeta?.turn_stage}
                  partialCanvas={envelopePartial}
                  defaultCollapsed={collapsibleCot}
                />
              ) : null}
              <EmptyCanvas />
            </div>
          </main>
        }
        chatPanel={
          <SoWhatRail
            splitEmbedded
            soWhat={emptySoWhat}
            initialQuery={bootstrapQuery}
            onFollowUp={handleFollowUp}
            chatMessages={chatMessages}
            chatPending={chatPending}
            progressLine={progressLine}
            showcaseOptions={devMeta?.showcase?.options}
            onShowcaseSelect={
              onFollowUpProp
                ? (cmd) => {
                    void handleFollowUp(cmd);
                  }
                : undefined
            }
          />
        }
      />
    );
  }

  const banners = (
    <>
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
    </>
  );

  return (
    <AtlasSessionWorkspace
      dataSource={dataSource}
      dataTestAttrs={{
        "data-mode": spec.mode,
        "data-recipe": spec.instrument?.recipe ?? "none",
      }}
      banners={banners}
      devMeta={devMeta}
      uxPrefs={uxPrefs}
      onUxPrefsChange={onUxPrefsChange}
      turnTiming={turnTiming}
      threads={threads}
      activeThreadId={activeThreadId}
      threadsLoading={threadsLoading}
      onSelectThread={onSelectThread}
      onNewThread={onNewThread}
      onNewSession={onNewSession}
      chatPending={chatPending}
      historyDisabled={historyDisabled}
      persistStatus={persistStatus}
      persistConfigured={persistConfigured}
      onDeleteThread={onDeleteThread}
      onRenameThread={onRenameThread}
      rehydrating={rehydrating}
      caseFileSpec={spec}
      onCaseFileSwot={onCaseFileSwot}
      onCaseEntityAttached={onCaseEntityAttached}
      canvasPanel={
        <main className={CANVAS_SHELL} style={{ background: T.canvas }}>
          <ScopeBar object={spec.object} scope={spec.scope} mode={spec.mode} tier={spec.tier} />
          <ConfidenceCeilingBar tier={spec.tier} />

          <div className={CANVAS_BODY}>
            <ProvenanceTrace
              provId={provId}
              provenance={spec.provenance}
              onClose={() => setProvId(null)}
              className="absolute right-4 top-4 z-20"
            />

            {spec.carriedFrom ? <CarriedFromBanner carriedFrom={spec.carriedFrom} /> : null}
            <DeclaredClaimsBlock spec={spec} />
            {canvasThinking ? (
              <CanvasThinking
                steps={reasoningTrace}
                active={canvasThinking}
                stage={devMeta?.turn_stage}
                partialCanvas={envelopePartial}
                defaultCollapsed={collapsibleCot}
              />
            ) : null}
            <div
              key={`${spec.mode}-${spec.instrument?.recipe ?? "none"}-${spec.canvas?.gate_status ?? ""}-${spec.verdict?.sentence?.slice(0, 48) ?? "partial"}-${devMeta?.partial_stage ?? "idle"}`}
              className={
                judgementLocked && spec
                  ? "atlas-canvas-morph-out"
                  : "atlas-canvas-morph"
              }
              style={{
                opacity: envelopePartial && canvasThinking && !judgementLocked ? 0.92 : 1,
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

              {judgementLocked && showStats ? (
                <div
                  className="atlas-synth-shimmer mb-4 rounded-lg border px-4 py-3"
                  style={{ borderColor: T.ruleSoft, background: "#F8F6F1" }}
                >
                  <p
                    className="m-0 uppercase"
                    style={{
                      fontFamily: atlasFont.mono,
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      color: T.inkFaint,
                    }}
                  >
                    Synthesising verdict & visual
                  </p>
                  <CanvasSectionSkeleton lines={2} />
                </div>
              ) : null}

              {showVisual ? (
                <>
                  {chartsForRender(spec, devMeta).map((chart, chartIdx) =>
                    chart?.option ? (
                      <ProgressiveCanvasSection
                        key={`chart-${chartIdx}-${chart.kind ?? "bar"}`}
                        visible
                        index={3 + chartIdx}
                        testId={`progressive-chart-${chartIdx}`}
                      >
                        <ChartCanvas
                          chart={chart}
                          verdict={spec.verdict?.sentence}
                          provenance={spec.provenance}
                          onProv={setProvId}
                        />
                      </ProgressiveCanvasSection>
                    ) : null,
                  )}
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
            className="flex shrink-0 gap-[18px] border-t px-4 py-2 sm:px-6 lg:px-8"
            style={{
              fontFamily: atlasFont.mono,
              fontSize: 10,
              color: T.inkFaint,
              borderColor: "#E7E3DC",
            }}
          >
            <span style={{ color: T.corpus }}>● corpus lane</span>
            <span style={{ color: T.web }}>● web lane</span>
            <span style={{ color: T.declared }}>◇ declared</span>
            <span style={{ color: T.gap }}>⌁ gap / contested</span>
            <span style={{ color: T.inkFaint }}>validated · candidate · verified</span>
          </div>
        </main>
      }
      chatPanel={
        <SoWhatRail
          splitEmbedded
          soWhat={spec.soWhat}
          initialQuery={spec.query}
          onFollowUp={handleFollowUp}
          chatMessages={chatMessages}
          chatPending={chatPending}
          progressLine={progressLine}
          showcaseOptions={showcaseOptions}
          onShowcaseSelect={onShowcaseSelect}
        />
      }
    />
  );
}
