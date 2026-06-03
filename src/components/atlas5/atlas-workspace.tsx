"use client";

import { Thread } from "@/components/thread";
import { ThreadList } from "@/components/thread-list";
import {
  AuiProvider,
  Suggestions,
  useAui,
  useAuiState,
  makeAssistantTool,
} from "@assistant-ui/react";
import { z } from "zod";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Loader2,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ArrowRight,
  AlertCircle,
  Target,
} from "lucide-react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import { useRef, useCallback, useState, useEffect, type FC } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { MyRuntimeProvider } from "@/components/atlas5/langgraph-runtime-provider";
import { ArtifactPane } from "@/components/atlas5/artifact-pane";
import { useArtifactStore } from "@/lib/atlas5/artifact-store";
import { buildArtifactFromAtlas } from "@/lib/atlas5/artifact-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChartSpec {
  type: "radar" | "bar" | "gauge" | "pie";
  title: string;
  data: Record<string, unknown>[];
  insight?: string;
  axis?: string;
  value?: string;
  x?: string;
  y?: string;
  max?: number;
}

interface DecisionSpine {
  decision: string;
  recommendation: string;
  confidence_tier: string;
  key_assumption: string;
  next_action: string;
}

interface ClaimEntry {
  text: string;
  state: string;
  confidence_tier: string;
  source: string;
}

interface ArtifactArgs {
  type: "brief" | "evidence" | "chart";
  recipe?: string;
  confidence_tier: "Speculative" | "Indicative" | "Supported" | "Robust";
  sections?: Record<string, string>;
  corpus_citations?: Array<{ id: string; title: string; organisation: string; score: number }>;
  hive_citations?: Array<{ article_id: string; title: string; score: number }>;
  npv_value?: number | null;
  discount_rate?: number;
  chart_specs?: ChartSpec[];
  section_scores?: Record<string, number>;
  decision_spine?: DecisionSpine;
  analysis?: string;
  claims?: ClaimEntry[];
  entry_friction_tags?: string[];
}

// No-op tool registration — handles old threads that stored artifact_block as a
// tool-call message (pre-values-stream migration). Without this, assistant-ui
// throws "Tool call name <uuid> null does not match existing tool call artifact_block".
const ArtifactBlockTool = makeAssistantTool({
  toolName: "artifact_block",
  description: "Legacy artifact signal — handled via values stream.",
  parameters: z.object({}).passthrough(),
  execute: async () => ({}),
  render: () => <></>,
});

// ---------------------------------------------------------------------------
// Recipe label map
// ---------------------------------------------------------------------------

const RECIPE_LABELS: Record<string, string> = {
  brief_five_case:           "Five Case Brief",
  cpc_capability_assessment: "Capability Assessment",
  cpc_market_alignment:      "Market Alignment",
  cpc_opportunity_fit:       "Opportunity Fit",
  cpc_portfolio_comparison:  "Portfolio Comparison",
  cpc_funding_flow:          "Funding Flow",
  cpc_evidence_gaps:         "Evidence Gaps",
  cpc_defend:                "Defend Report",
};

function recipeLabel(recipe?: string) {
  return recipe ? (RECIPE_LABELS[recipe] ?? recipe) : "Five Case Brief";
}

// ---------------------------------------------------------------------------
// Confidence tier badge
// ---------------------------------------------------------------------------

const TIER_COLORS = {
  Speculative: "bg-slate-100 text-slate-600 border-slate-200",
  Indicative:  "bg-amber-50  text-amber-700  border-amber-200",
  Supported:   "bg-blue-50   text-blue-700   border-blue-200",
  Robust:      "bg-emerald-50 text-emerald-700 border-emerald-200",
} as const;

const TIER_SCORES = { Speculative: 20, Indicative: 45, Supported: 65, Robust: 85 } as const;

function ConfidenceBadge({ tier }: { tier: keyof typeof TIER_COLORS }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TIER_COLORS[tier]}`}>
      {tier}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Chart components
// ---------------------------------------------------------------------------

const CHART_COLORS = ["#6366f1", "#a5b4fc", "#818cf8", "#c7d2fe", "#e0e7ff"];

function RadarChartBlock({ spec }: { spec: ChartSpec }) {
  const axisKey = spec.axis ?? "case";
  const valueKey = spec.value ?? "score";
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{spec.title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <RadarChart data={spec.data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey={axisKey} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
          <PolarRadiusAxis angle={90} domain={[0, spec.max ?? 100]} tick={false} axisLine={false} />
          <Radar
            dataKey={valueKey}
            fill="#6366f1"
            fillOpacity={0.25}
            stroke="#6366f1"
            strokeWidth={1.5}
          />
        </RadarChart>
      </ResponsiveContainer>
      {spec.insight && (
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{spec.insight}</p>
      )}
    </div>
  );
}

function BarChartBlock({ spec }: { spec: ChartSpec }) {
  const xKey = spec.x ?? "source";
  const yKey = spec.y ?? "score";
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{spec.title}</p>
      <ResponsiveContainer width="100%" height={Math.max(100, spec.data.length * 22)}>
        <BarChart layout="vertical" data={spec.data} margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey={xKey}
            width={90}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            formatter={(v) => [`${v}%`]}
            contentStyle={{ fontSize: 10, padding: "2px 8px" }}
          />
          <Bar dataKey={yKey} radius={[0, 3, 3, 0]} maxBarSize={14}>
            {spec.data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#6366f1" : "#a5b4fc"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {spec.insight && (
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{spec.insight}</p>
      )}
    </div>
  );
}

function GaugeBlock({ spec }: { spec: ChartSpec }) {
  const score = (spec.data[0]?.value as number) ?? TIER_SCORES[spec.title.split(" - ")[1] as keyof typeof TIER_SCORES] ?? 50;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{spec.title}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0">{pct}%</span>
      </div>
      {spec.insight && (
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{spec.insight}</p>
      )}
    </div>
  );
}

function ChartBlock({ spec }: { spec: ChartSpec }) {
  switch (spec.type) {
    case "radar": return <RadarChartBlock spec={spec} />;
    case "bar":   return <BarChartBlock spec={spec} />;
    case "gauge": return <GaugeBlock spec={spec} />;
    default:      return null;
  }
}

// ---------------------------------------------------------------------------
// Decision spine card
// ---------------------------------------------------------------------------

function DecisionSpineCard({ spine }: { spine: DecisionSpine }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-indigo-50/60 border-indigo-200/80 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-indigo-50 transition-colors"
      >
        <Target className="size-3.5 text-indigo-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 mb-0.5">Recommendation</p>
          <p className="text-xs text-foreground leading-snug line-clamp-3">{spine.recommendation || spine.decision}</p>
        </div>
        <ChevronRight className={`size-3.5 text-indigo-400 shrink-0 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-indigo-200/60 px-3 py-2.5 space-y-2.5 bg-white/60">
          {spine.key_assumption && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-0.5">
                <AlertCircle className="size-3 text-amber-500" /> Key assumption
              </p>
              <p className="text-[11px] text-foreground/80 leading-snug">{spine.key_assumption}</p>
            </div>
          )}
          {spine.next_action && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-0.5">
                <ArrowRight className="size-3 text-emerald-500" /> Next action
              </p>
              <p className="text-[11px] text-foreground/80 leading-snug">{spine.next_action}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section scores bar
// ---------------------------------------------------------------------------

const SCORE_LABEL: Record<number, string> = {
  0:  "No data",
  20: "Thin",
  40: "Partial",
  60: "Moderate",
  80: "Strong",
};
function scoreLabel(n: number) {
  const keys = [0, 20, 40, 60, 80];
  const key = keys.reduce((prev, k) => (n >= k ? k : prev), 0);
  return SCORE_LABEL[key];
}

function SectionScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-emerald-500" :
    score >= 55 ? "bg-blue-500" :
    score >= 35 ? "bg-amber-500" : "bg-rose-400";
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[9px] text-muted-foreground font-mono shrink-0">{scoreLabel(score)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact panel
// ---------------------------------------------------------------------------

const SECTION_ORDER = [
  "Strategic Case",
  "Economic Case",
  "Commercial Case",
  "Financial Case",
  "Management Case",
];

function ArtifactPanel({ artifact, statusText }: { artifact: ArtifactArgs | null; statusText?: string }) {
  const [openSection, setOpenSection] = useState<string | null>("Strategic Case");
  const isRunning = useAuiState((s) => (s.thread as unknown as { isRunning?: boolean }).isRunning ?? false);

  // Loading state
  if (!artifact && isRunning) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div className="rounded-full border bg-indigo-50 border-indigo-200 p-3">
          <Loader2 className="size-5 text-indigo-500 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">Building brief…</p>
          <p className="text-xs text-muted-foreground animate-pulse">
            {statusText ?? "Searching corpus · Drafting brief · Verifying citations"}
          </p>
        </div>
        <div className="w-full max-w-[200px] space-y-1.5 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg bg-muted/60" />)}
        </div>
      </div>
    );
  }

  // Empty state
  if (!artifact) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="rounded-full border bg-muted/40 p-4">
          <FileText className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Brief will appear here</p>
        <p className="text-xs text-muted-foreground/70 max-w-[220px]">
          Ask ATLAS a strategic question to generate a Five Case brief with corpus citations.
        </p>
      </div>
    );
  }

  const sections = artifact.sections ?? {};
  const chartSpecs = artifact.chart_specs ?? [];
  const scores = artifact.section_scores ?? {};
  const orderedSections = [
    ...SECTION_ORDER.filter(k => k in sections),
    ...Object.keys(sections).filter(k => !SECTION_ORDER.includes(k)),
  ];

  // Only render radar + bar (skip gauge — confidence badge already covers it, skip pie)
  const visibleCharts = chartSpecs.filter(c => c.type === "radar" || c.type === "bar").slice(0, 2);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-indigo-600" />
          <span className="text-sm font-semibold">{recipeLabel(artifact.recipe)}</span>
          {isRunning && <Loader2 className="size-3.5 text-amber-500 animate-spin" />}
        </div>
        <ConfidenceBadge tier={artifact.confidence_tier} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* Decision spine */}
        {artifact.decision_spine?.recommendation && (
          <DecisionSpineCard spine={artifact.decision_spine} />
        )}

        {/* NPV */}
        {artifact.npv_value != null && (
          <div className={`rounded-lg border px-3 py-2.5 ${artifact.npv_value >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Net Present Value</p>
            <p className={`text-lg font-bold mt-0.5 ${artifact.npv_value >= 0 ? "text-emerald-800" : "text-rose-700"}`}>
              £{(artifact.npv_value / 1e6).toFixed(1)}m
            </p>
            <p className={`text-[10px] ${artifact.npv_value >= 0 ? "text-emerald-600" : "text-rose-500"}`}>@ {((artifact.discount_rate ?? 0.035) * 100).toFixed(1)}% STPR</p>
          </div>
        )}

        {/* Charts */}
        {visibleCharts.length > 0 && (
          <div className="space-y-3">
            {visibleCharts.map((spec, i) => (
              <div key={i} className="rounded-lg border bg-muted/10 px-3 py-2.5">
                <ChartBlock spec={spec} />
              </div>
            ))}
          </div>
        )}

        {/* Report sections */}
        {orderedSections.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
              {artifact.recipe === "brief_five_case" || !artifact.recipe ? "Five Case Model" : recipeLabel(artifact.recipe)}
            </p>
            {orderedSections.map((key) => {
              const isOpen = openSection === key;
              const score = scores[key];
              return (
                <div key={key} className="rounded-lg border overflow-hidden">
                  <button
                    onClick={() => setOpenSection(isOpen ? null : key)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-foreground">{key}</span>
                      {score !== undefined && <SectionScoreBar score={score} />}
                    </div>
                    <ChevronRight className={`size-3.5 text-muted-foreground ml-2 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-0 border-t bg-muted/10">
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap mt-2">
                        {sections[key]}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Entry friction tags (Diagnose mode) */}
        {artifact.entry_friction_tags && artifact.entry_friction_tags.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">Entry Friction</p>
            <div className="flex flex-wrap gap-1.5">
              {artifact.entry_friction_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                >
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Claims (Defend mode) */}
        {artifact.claims && artifact.claims.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">Claims</p>
            {artifact.claims.map((claim, i) => (
              <div key={i} className="rounded-lg border bg-muted/20 px-3 py-2 space-y-1">
                <p className="text-xs text-foreground leading-snug">{claim.text}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <ConfidenceBadge tier={claim.confidence_tier as keyof typeof TIER_COLORS} />
                  <span className="text-[9px] font-mono text-muted-foreground">{claim.state}</span>
                  {claim.source && (
                    <span className="text-[9px] text-muted-foreground truncate max-w-[180px]">· {claim.source}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CPC Corpus citations */}
        {artifact.corpus_citations && artifact.corpus_citations.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 px-0.5">
              <BookOpen className="size-3" /> CPC Corpus
            </p>
            {artifact.corpus_citations.map((c, i) => (
              <div key={c.id} className="rounded-md border bg-muted/20 px-3 py-2 flex items-start gap-2">
                <span className="shrink-0 mt-0.5 font-mono text-[10px] text-muted-foreground">[{i + 1}]</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground">{c.organisation}</p>
                </div>
                <span className="shrink-0 ml-auto text-[10px] text-muted-foreground font-mono">
                  {(c.score * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArtifactRunBridge — fires startRun() the instant the thread transitions to
// running, giving the ThinkingIndicator immediate feedback before the first
// values event arrives from the Python agent.
// ---------------------------------------------------------------------------

function ArtifactRunBridge() {
  const isRunning = useAuiState(
    (s) => (s.thread as unknown as { isRunning?: boolean }).isRunning ?? false,
  );
  const { startRun, clearLoading, isLoading, artifact } = useArtifactStore();
  const wasRunningRef = useRef(false);

  useEffect(() => {
    if (isRunning && !wasRunningRef.current) {
      // Low→high edge: message just sent — show loading indicator immediately
      startRun();
    } else if (!isRunning && wasRunningRef.current && isLoading && !artifact) {
      // High→low edge: run finished but no artifact arrived (error / cancel / 500)
      // Clear the thinking indicator so it doesn't stay stuck forever
      clearLoading();
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, startRun, clearLoading, isLoading, artifact]);

  return null;
}

// ---------------------------------------------------------------------------
// Thread with Atlas suggestions
// ---------------------------------------------------------------------------

const ATLAS_SUGGESTIONS = Suggestions([
  {
    title: "Explore",
    label: "the innovation landscape",
    prompt:
      "Explore the innovation landscape for connected and autonomous transport in the UK.",
  },
  {
    title: "Assess",
    label: "a capability or product",
    prompt:
      "Assess CPC's capability evidence for leading an autonomous freight R&D programme.",
  },
  {
    title: "Build",
    label: "an investment case",
    prompt:
      "Build a Green Book investment case for a UK autonomous freight corridor pilot programme.",
  },
]);

const ThreadWithSuggestions: FC = () => {
  const aui = useAui({ suggestions: ATLAS_SUGGESTIONS });
  return (
    <AuiProvider value={aui}>
      <ArtifactBlockTool />
      {/* Fires startRun() immediately when thread becomes running — before first values event */}
      <ArtifactRunBridge />
      <Thread />
    </AuiProvider>
  );
};

// ---------------------------------------------------------------------------
// Resize handle with collapse toggle
// ---------------------------------------------------------------------------

function CollapseHandle({
  onToggle,
  collapsed,
  side,
}: {
  onToggle: () => void;
  collapsed: boolean;
  side: "left" | "right";
}) {
  const Icon =
    side === "left"
      ? collapsed ? PanelLeftOpen : PanelLeftClose
      : collapsed ? PanelRightOpen : PanelRightClose;

  return (
    // When collapsed the panel beside this handle is 0px — widen the handle so it's still
    // hoverable and clickable. Full opacity when collapsed so the button is always findable.
    <PanelResizeHandle
      className={`group relative flex items-center justify-center bg-border transition-colors hover:bg-border/80 data-[resize-handle-active]:bg-primary/30 ${collapsed ? "w-5" : "w-px"}`}
    >
      <button
        onClick={onToggle}
        className={`absolute z-10 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-opacity hover:text-foreground ${collapsed ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        title={collapsed ? "Expand" : "Collapse"}
      >
        <Icon className="size-3" />
      </button>
    </PanelResizeHandle>
  );
}

// ---------------------------------------------------------------------------
// Page — three-column resizable layout
// ---------------------------------------------------------------------------

export default function LangGraphPage() {
  const threadListRef = useRef<ImperativePanelHandle>(null);
  const artifactRef = useRef<ImperativePanelHandle>(null);
  const [threadCollapsed, setThreadCollapsed] = useState(false);
  const [artifactCollapsed, setArtifactCollapsed] = useState(false);
  const { setArtifact, setPartialArtifact, startRun, setStatusText, setReasoningTrace } = useArtifactStore();

  // Collapse the thread list on initial mount — looks cleaner on first load.
  // Using imperative handle is more reliable than defaultSize={0} with resizable panels.
  useEffect(() => {
    const panel = threadListRef.current;
    if (panel && !panel.isCollapsed()) {
      panel.collapse();
    }
  }, []);

  const toggleThreadList = useCallback(() => {
    const panel = threadListRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand(); else panel.collapse();
  }, []);

  const toggleArtifact = useCallback(() => {
    const panel = artifactRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand(); else panel.collapse();
  }, []);

  // Auto-expand artifact panel when sections start arriving
  const autoExpandArtifact = useCallback(() => {
    const panel = artifactRef.current;
    if (panel && panel.isCollapsed()) {
      panel.expand();
    }
  }, []);

  const handleValues = useCallback((values: Record<string, unknown>) => {
    // ── 1. Reasoning trace — update on every node transition ─────────────
    const trace = values.reasoning_trace;
    if (Array.isArray(trace) && trace.length > 0) {
      setReasoningTrace(trace as Array<{ node?: string; thought: string; evidence_count?: number }>);
      const last = trace[trace.length - 1] as Record<string, unknown>;
      const thought = typeof last.thought === "string" ? last.thought : undefined;
      if (thought) setStatusText(thought);
    }

    // ── 2. Artifact — progressive partial or final ─────────────────────────
    const ab = values.artifact_block;
    if (ab && typeof ab === "object" && !Array.isArray(ab)) {
      const raw = ab as Record<string, unknown>;
      const stage = raw._run_stage as string | undefined;
      const built = buildArtifactFromAtlas(raw);
      autoExpandArtifact();

      if (stage === "complete" || (raw.visual_blocks && (raw.visual_blocks as unknown[]).length > 0)) {
        setArtifact(built);
        return;
      }
      if (stage === "search" || stage === "build") {
        setPartialArtifact(built);
        return;
      }
      if (raw.sections && Object.keys(raw.sections as object).length > 0) {
        setArtifact(built);
        return;
      }
    }

    // Legacy partial — sections without artifact_block
    const intermediateSections = values.sections;
    if (
      !ab &&
      intermediateSections &&
      typeof intermediateSections === "object" &&
      !Array.isArray(intermediateSections)
    ) {
      const sectionKeys = Object.keys(intermediateSections as object);
      if (sectionKeys.length > 0) {
        autoExpandArtifact();
        setPartialArtifact(buildArtifactFromAtlas({
          ...values,
          sections: intermediateSections as Record<string, string>,
          confidence_tier: (values.confidence_tier as string) ?? "Speculative",
        }));
      }
    }
  }, [setArtifact, setPartialArtifact, setStatusText, setReasoningTrace, autoExpandArtifact]);

  return (
    <MyRuntimeProvider onValues={handleValues}>
      <div className="h-dvh overflow-hidden bg-background text-foreground antialiased flex flex-col">
        <div className="shrink-0 flex items-center justify-end border-b bg-muted/20 px-3 py-1 text-[10px] text-muted-foreground">
          <a href="/lab/copilotkit" className="underline hover:text-foreground">CopilotKit lab</a>
          <span className="text-muted-foreground/50">·</span>
          <a href="/lab/blocks" className="underline hover:text-foreground">Block gallery</a>
        </div>
        <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal" className="h-full">

          {/* Col 1: thread list — collapsed on mount via useEffect; toggle always visible */}
          <Panel
            ref={threadListRef}
            defaultSize={15}
            minSize={12}
            collapsible
            collapsedSize={0}
            onCollapse={() => setThreadCollapsed(true)}
            onExpand={() => setThreadCollapsed(false)}
            className="overflow-y-auto border-r"
          >
            <div className="p-2">
              <ThreadList />
            </div>
          </Panel>

          <CollapseHandle
            onToggle={toggleThreadList}
            collapsed={threadCollapsed}
            side="left"
          />

          {/* Col 2: chat */}
          <Panel minSize={22} defaultSize={40} className="min-w-0">
            <ThreadWithSuggestions />
          </Panel>

          <CollapseHandle
            onToggle={toggleArtifact}
            collapsed={artifactCollapsed}
            side="right"
          />

          {/* Col 3: artifact panel — 60% default, primary workspace */}
          <Panel
            ref={artifactRef}
            defaultSize={60}
            minSize={30}
            collapsible
            collapsedSize={0}
            onCollapse={() => setArtifactCollapsed(true)}
            onExpand={() => setArtifactCollapsed(false)}
            className="border-l bg-muted/10"
          >
            <ArtifactPane />
          </Panel>

        </PanelGroup>
        </div>
      </div>
    </MyRuntimeProvider>
  );
}
