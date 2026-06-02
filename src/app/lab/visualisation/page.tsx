"use client";

/**
 * /lab/visualisation — Art Director Vocabulary & Workbench
 *
 * Three sections (vertical, no tabs):
 *   1. Vocabulary — the art director's registry. Only "ready" blocks
 *      are available to the agent. Experimental blocks are in R&D.
 *   2. Workbench — compose a blocks[] array and preview how it renders.
 *   3. Research  — framework comparisons, bake-off (collapsed by default).
 *
 * The BLOCK_VOCABULARY array in block-vocabulary.ts is the single source
 * of truth. This page reads from it; so does BlockRenderer.
 * The Python build_visual_blocks() uses the same type strings.
 */

import { useState, useCallback } from "react";
import {
  BLOCK_VOCABULARY,
  getReadyBlocks,
  type BlockVocabularyEntry,
  type BlockStatus,
  type VisualBlock,
} from "@/lib/atlas5/block-vocabulary";
import { BlockRenderer } from "@/components/atlas5/block-renderer";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  FlaskConical,
  Archive,
  Play,
  RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<BlockStatus, string> = {
  ready:        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  experimental: "bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950/40  dark:text-amber-300",
  deprecated:   "bg-slate-100 text-slate-500  border-slate-200  dark:bg-slate-800     dark:text-slate-400",
};

const STATUS_ICONS: Record<BlockStatus, React.ReactNode> = {
  ready:        <CheckCircle2 className="size-3" />,
  experimental: <FlaskConical className="size-3" />,
  deprecated:   <Archive className="size-3" />,
};

const STATUS_LABELS: Record<BlockStatus, string> = {
  ready:        "Art Director Ready",
  experimental: "Experimental",
  deprecated:   "Deprecated",
};

function StatusBadge({ status }: { status: BlockStatus }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
      STATUS_STYLES[status],
    )}>
      {STATUS_ICONS[status]}
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Vocabulary card
// ---------------------------------------------------------------------------

function VocabularyCard({ entry }: { entry: BlockVocabularyEntry }) {
  const [expanded, setExpanded] = useState(false);

  const previewBlock: VisualBlock = {
    type: entry.type,
    title: entry.label,
    data: entry.example_data,
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-sm",
        entry.status === "ready" ? "border-border" :
        entry.status === "experimental" ? "border-amber-200/60 dark:border-amber-800/40" :
        "border-slate-200/60 dark:border-slate-700/40 opacity-60",
      )}
    >
      {/* Card header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-border bg-muted/10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-foreground font-mono">{entry.type}</span>
            <StatusBadge status={entry.status} />
            <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
              {entry.library}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{entry.when_to_use}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          aria-expanded={expanded}
        >
          {expanded
            ? <ChevronDown className="size-4" />
            : <ChevronRight className="size-4" />}
        </button>
      </div>

      {/* Live preview — always visible for ready blocks */}
      {entry.status !== "deprecated" && (
        <div className="px-3 py-3">
          <BlockRenderer block={previewBlock} />
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/5">
          {/* Required fields */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Required fields
            </p>
            <div className="flex flex-wrap gap-1">
              {entry.required_fields.map((f) => (
                <code key={f} className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-foreground">
                  {f}
                </code>
              ))}
            </div>
          </div>

          {/* Intent triggers */}
          {entry.intent_triggers.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Intent triggers
              </p>
              <div className="flex flex-wrap gap-1">
                {entry.intent_triggers.map((t) => (
                  <span key={t} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 rounded-full px-2 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {entry.conflicts_with && entry.conflicts_with.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Conflicts with — prefer one over the other
              </p>
              <div className="flex flex-wrap gap-1">
                {entry.conflicts_with.map((c) => (
                  <code key={c} className="text-[10px] bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 rounded px-1.5 py-0.5">
                    {c}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Min data points */}
          <p className="text-[10px] text-muted-foreground">
            Minimum data points to earn its place: <span className="font-semibold text-foreground">{entry.min_data_points}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workbench — compose blocks[] and preview
// ---------------------------------------------------------------------------

const WORKBENCH_DEFAULT = JSON.stringify(
  [
    {
      type: "domain_heatmap",
      title: "Evidence density — paste your own data",
      data: {
        domains: [
          { domain: "Urban Mobility", project_count: 8, avg_score: 0.72 },
          { domain: "Freight Automation", project_count: 5, avg_score: 0.61 },
          { domain: "EV Infrastructure", project_count: 3, avg_score: 0.58 },
        ],
      },
    },
  ],
  null,
  2,
);

function Workbench() {
  const [json, setJson] = useState(WORKBENCH_DEFAULT);
  const [blocks, setBlocks] = useState<VisualBlock[]>(() => {
    try { return JSON.parse(WORKBENCH_DEFAULT) as VisualBlock[]; } catch { return []; }
  });
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    try {
      const parsed = JSON.parse(json) as VisualBlock[];
      setBlocks(Array.isArray(parsed) ? parsed : [parsed as VisualBlock]);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [json]);

  const reset = () => {
    setJson(WORKBENCH_DEFAULT);
    setBlocks(JSON.parse(WORKBENCH_DEFAULT) as VisualBlock[]);
    setError(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            blocks[] JSON
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors border border-border rounded px-2 py-1"
            >
              <RotateCcw className="size-3" /> Reset
            </button>
            <button
              type="button"
              onClick={run}
              className="flex items-center gap-1 text-[10px] font-semibold bg-indigo-600 text-white rounded px-2.5 py-1 hover:bg-indigo-700 transition-colors"
            >
              <Play className="size-3" /> Preview
            </button>
          </div>
        </div>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          className="w-full h-80 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-xs font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
          spellCheck={false}
          aria-label="blocks[] JSON input"
        />
        {error && (
          <p className="text-xs text-red-500 font-mono">{error}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          Paste any blocks[] array to preview how the art director would compose it.
          Type strings must match vocabulary entries above.
        </p>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Live preview
        </p>
        <div className="rounded-lg border border-border bg-card p-3 min-h-80 space-y-3">
          {blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No valid blocks yet.</p>
          ) : (
            blocks.map((block, i) => (
              <BlockRenderer key={`${block.type}-${i}`} block={block} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Research section (collapsed by default — framework comparisons etc.)
// ---------------------------------------------------------------------------

function ResearchSection() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">🔬 Research</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Framework comparisons (Recharts vs ECharts vs Vega-Lite), network graph experiments.
            These are for your R&amp;D — they do not affect what the art director can use.
          </p>
        </div>
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border px-4 py-4">
          <p className="text-xs text-muted-foreground">
            Framework bake-off and network graph content available at{" "}
            <code className="text-[11px] bg-muted rounded px-1">/lab/visualisation/research</code>{" "}
            (coming soon — consolidated here when needed).
            For now: use the Workbench above to test any chart type with real data shapes.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type FilterStatus = "all" | BlockStatus;

export default function VisualisationLabPage() {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showWorkbench, setShowWorkbench] = useState(false);

  const readyCount       = BLOCK_VOCABULARY.filter((b) => b.status === "ready").length;
  const experimentalCount = BLOCK_VOCABULARY.filter((b) => b.status === "experimental").length;

  const displayed = BLOCK_VOCABULARY.filter(
    (b) => filter === "all" || b.status === filter,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Art Director Vocabulary</h1>
            <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">Lab</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            What ATLAS can see and pick from. Each{" "}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Ready</span>{" "}
            block here is available to the art director. Mark it Ready here — it ships to the agent.
          </p>

          {/* Quick stats */}
          <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span className="font-semibold text-foreground">{readyCount}</span> ready
            </span>
            <span className="flex items-center gap-1">
              <FlaskConical className="size-3 text-amber-500" />
              <span className="font-semibold text-foreground">{experimentalCount}</span> experimental
            </span>
            <span>
              Skills file: <code className="text-[11px] bg-muted rounded px-1">skills/data-visualization.md</code>
            </span>
          </div>
        </div>

        {/* ── Vocabulary section ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Block Vocabulary
            </h2>
            {/* Filter */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-0.5">
              {(["all", "ready", "experimental", "deprecated"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-md px-3 py-1 text-[11px] font-medium transition-colors capitalize",
                    filter === f
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayed.map((entry) => (
              <VocabularyCard key={entry.type} entry={entry} />
            ))}
          </div>
        </section>

        {/* ── Workbench ──────────────────────────────────────────────────── */}
        <section>
          <button
            type="button"
            onClick={() => setShowWorkbench((v) => !v)}
            className="w-full flex items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-muted/30 transition-colors bg-card"
            aria-expanded={showWorkbench}
          >
            <div>
              <p className="text-sm font-semibold text-foreground">🎨 Workbench</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compose a blocks[] array and see how it renders — exactly as the art director would.
              </p>
            </div>
            {showWorkbench
              ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
          </button>
          {showWorkbench && (
            <div className="mt-4">
              <Workbench />
            </div>
          )}
        </section>

        {/* ── Research ───────────────────────────────────────────────────── */}
        <ResearchSection />

      </div>
    </div>
  );
}
