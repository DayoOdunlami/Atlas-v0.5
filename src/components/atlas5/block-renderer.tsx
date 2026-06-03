"use client";

/**
 * Atlas 5 — Block Renderer
 *
 * Maps visual_block.type → the right React component.
 * Every block type in BLOCK_VOCABULARY (status: "ready") must have
 * a case here.
 *
 * Data contracts match the typed interfaces in block-vocabulary.ts.
 * The Python build_visual_blocks() emits the same shapes.
 */

import { cn } from "@/lib/utils";
import type { VisualBlock } from "@/lib/atlas5/types";
import type {
  DomainHeatmapData,
  OptionsComparisonData,
  EvidenceBarData,
  RadarData,
  NpvWaterfallData,
  KnowledgeGraphData,
  SankeyData,
  GapMatrixData,
  ScatterData,
  BarData,
  AreaLineData,
} from "@/lib/atlas5/block-vocabulary";
import {
  EChartsChart,
  buildRadarOption,
  buildEChartGraphOption,
  type GraphNode,
  type GraphEdge,
} from "@/components/lab/echarts-chart";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, ComposedChart, Cell,
  type TooltipProps,
} from "recharts";
import { ClaimStateBadge } from "@/components/atlas5/claim-state-badge";
import { FitBadge } from "@/components/atlas5/recipes/surface-primitives";
import { AlertTriangle, CheckCircle, Minus } from "lucide-react";
import type { EChartsOption } from "echarts";

// ---------------------------------------------------------------------------
// Shared block wrapper
// ---------------------------------------------------------------------------

function BlockShell({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}>
      {title && (
        <div className="px-3 py-2 border-b border-border bg-muted/20">
          <p className="text-xs font-semibold text-foreground leading-snug">{title}</p>
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// domain_heatmap — ECharts heatmap of evidence density per domain
// ---------------------------------------------------------------------------

function buildDomainHeatmapOption(domains: DomainHeatmapData["domains"]): EChartsOption {
  const names = domains.map((d) => d.domain);
  const metrics = ["Projects", "Avg Score"];
  const cells: [number, number, number][] = [];

  domains.forEach((d, xi) => {
    cells.push([xi, 0, d.project_count]);
    cells.push([xi, 1, Math.round(d.avg_score * 100)]);
  });

  const maxVal = Math.max(...cells.map((c) => c[2]), 1);

  return {
    backgroundColor: "transparent",
    grid: { left: "12%", right: "5%", top: "5%", bottom: "28%", containLabel: false },
    xAxis: {
      type: "category",
      data: names,
      axisLabel: { color: "#94a3b8", fontSize: 9, rotate: -20, interval: 0 },
      axisLine: { lineStyle: { color: "#4b5563" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: metrics,
      axisLabel: { color: "#94a3b8", fontSize: 9 },
      axisLine: { lineStyle: { color: "#4b5563" } },
      axisTick: { show: false },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: false,
      show: false,
      inRange: { color: ["#1e293b", "#1d4ed8", "#10b981"] },
    },
    tooltip: {
      formatter: (p: unknown) => {
        const params = p as { value: [number, number, number] };
        const domain = names[params.value[0]] ?? "";
        const metric = metrics[params.value[1]] ?? "";
        return `${domain}<br/>${metric}: <b>${params.value[2]}</b>`;
      },
    },
    series: [{
      type: "heatmap",
      data: cells,
      label: {
        show: true,
        formatter: (p: unknown) => {
          const params = p as { value: [number, number, number] };
          return params.value[2] === 0 ? "sparse" : String(params.value[2]);
        },
        color: "#f8fafc",
        fontSize: 9,
      },
      itemStyle: { borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.4)" } },
    }],
  };
}

function DomainHeatmapBlock({ block }: { block: VisualBlock }) {
  const d = block.data as DomainHeatmapData;
  if (!d?.domains?.length) return null;
  return (
    <BlockShell title={block.title}>
      <EChartsChart
        option={buildDomainHeatmapOption(d.domains)}
        style={{ height: "140px", width: "100%" }}
      />
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// knowledge_graph — ECharts force-directed graph
// ---------------------------------------------------------------------------

function KnowledgeGraphBlock({ block, showcase = false }: { block: VisualBlock; showcase?: boolean }) {
  const d = block.data as KnowledgeGraphData;
  if (!d?.nodes?.length) return null;

  const nodeCount = d.nodes.length;
  const repulsion = Math.min(420, 140 + nodeCount * 22);

  const nodes: GraphNode[] = d.nodes.map((n) => ({
    id: n.id,
    name: n.label.length > 28 ? `${n.label.slice(0, 26)}…` : n.label,
    category: n.group,
    value: n.value,
  }));

  const edges: GraphEdge[] = d.edges.map((e) => ({
    source: e.source,
    target: e.target,
    label: e.label,
  }));

  return (
    <BlockShell title={block.title}>
      <EChartsChart
        option={buildEChartGraphOption(nodes, edges, {
          repulsion,
          labelMinSize: showcase ? 12 : 10,
          hideLabelsUntilHover: nodeCount > 6,
        })}
        style={{ height: showcase ? "420px" : "360px", width: "100%" }}
      />
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// options_comparison — strategic options as a comparison table
// ---------------------------------------------------------------------------

const FIT_COLOUR: Record<number, string> = {};
function fitColour(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function OptionsComparisonBlock({ block }: { block: VisualBlock }) {
  const d = block.data as OptionsComparisonData;
  if (!d?.options?.length) return null;

  return (
    <BlockShell title={block.title}>
      <div className="divide-y divide-border">
        {d.options.map((opt, i) => (
          <div key={i} className="py-2.5 flex items-start gap-3">
            <span className={cn("text-sm font-bold tabular-nums shrink-0 w-8", fitColour(opt.fit_score))}>
              {opt.fit_score}%
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground leading-snug">{opt.option}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.rationale}</p>
            </div>
            <span className={cn(
              "text-[10px] font-semibold rounded-full border px-2 py-0.5 shrink-0",
              opt.action === "bid" ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" :
              opt.action === "partner" ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300" :
              "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
            )}>
              {opt.action}
            </span>
          </div>
        ))}
      </div>
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// evidence_bar — horizontal bar ranked by relevance
// ---------------------------------------------------------------------------

function EvidenceBarBlock({ block }: { block: VisualBlock }) {
  const d = block.data as EvidenceBarData;
  if (!d?.items?.length) return null;

  const COLOURS = ["#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff"];

  return (
    <BlockShell title={block.title}>
      <ResponsiveContainer width="100%" height={Math.max(100, d.items.length * 28)}>
        <BarChart layout="vertical" data={d.items} margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tick={{ fontSize: 9, fill: "#94a3b8" }}
          />
          <Tooltip
            formatter={(v: number) => [`${v}%`, "Score"]}
            contentStyle={{ fontSize: 10, padding: "2px 8px" }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {d.items.map((_, i) => (
              <Cell key={i} fill={COLOURS[i % COLOURS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// radar — Five Case five-pillar spider
// ---------------------------------------------------------------------------

function RadarBlock({ block }: { block: VisualBlock }) {
  const d = block.data as RadarData;
  if (!d?.dimensions?.length) return null;

  // buildRadarOption expects Record<string, number>
  const radarData: Record<string, number> = {};
  d.dimensions.forEach((dim) => { radarData[dim.dimension] = dim.score; });

  return (
    <BlockShell title={block.title}>
      <EChartsChart
        option={buildRadarOption(radarData)}
        style={{ height: "180px", width: "100%" }}
      />
      {d.insight && (
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug px-1">{d.insight}</p>
      )}
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// npv_waterfall — NPV decomposition waterfall
// ---------------------------------------------------------------------------

function NpvWaterfallBlock({ block }: { block: VisualBlock }) {
  const d = block.data as NpvWaterfallData;
  if (!d?.components?.length) return null;

  // Build running total for waterfall positioning
  let running = 0;
  const chartData = d.components.map((c) => {
    if (c.type === "total") {
      return { name: c.label, value: c.value, base: 0, type: "total", raw: c.value };
    }
    const base = running;
    running += c.value;
    return { name: c.label, value: Math.abs(c.value), base, type: c.type, raw: c.value };
  });

  const getColour = (type: string) =>
    type === "positive" ? "#10b981" : type === "negative" ? "#ef4444" : "#6366f1";

  return (
    <BlockShell title={block.title}>
      <p className="text-[10px] text-muted-foreground mb-2">
        HMT STPR {(d.discount_rate * 100).toFixed(1)}% discount rate
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 24, left: 8 }}>
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} angle={-20} textAnchor="end" />
          <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickFormatter={(v) => `£${(v / 1).toFixed(0)}m`} />
          <Tooltip
            formatter={(v: number, _name: string, props: { payload?: { raw?: number; type?: string } }) => {
              const raw = props?.payload?.raw ?? v;
              return [`£${raw.toFixed(1)}m`, "Value"];
            }}
            contentStyle={{ fontSize: 10 }}
          />
          {/* Invisible base bar to offset visible bar */}
          <Bar dataKey="base" stackId="a" fill="transparent" />
          <Bar dataKey="value" stackId="a" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={getColour(entry.type)} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// sankey — funding flow
// ---------------------------------------------------------------------------

function SankeyBlock({ block }: { block: VisualBlock }) {
  const d = block.data as SankeyData;
  if (!d?.flows?.length) return null;

  const nodeSet = new Set<string>();
  d.flows.forEach(({ source, target }) => { nodeSet.add(source); nodeSet.add(target); });

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: { trigger: "item", triggerOn: "mousemove" },
    series: [{
      type: "sankey",
      data: [...nodeSet].map((name) => ({ name })),
      links: d.flows.map(({ source, target, value }) => ({ source, target, value })),
      emphasis: { focus: "adjacency" },
      lineStyle: { color: "gradient", curveness: 0.5 },
      label: { color: "#94a3b8", fontSize: 10 },
      nodeWidth: 12,
      nodeGap: 12,
    }],
  };

  return (
    <BlockShell title={block.title}>
      <EChartsChart option={option} style={{ height: "200px", width: "100%" }} />
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// gap_matrix — evidence gap table
// ---------------------------------------------------------------------------

function GapMatrixBlock({ block }: { block: VisualBlock }) {
  const d = block.data as GapMatrixData;
  if (!d?.rows?.length) return null;

  return (
    <BlockShell title={block.title}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-3 font-medium">Criterion</th>
              <th className="text-left py-1.5 pr-3 font-medium">Response</th>
              <th className="text-left py-1.5 pr-2 font-medium w-12">State</th>
              <th className="text-left py-1.5 font-medium w-16">Fit</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                <td className="py-2 pr-3 font-medium text-foreground align-top">{row.criterion}</td>
                <td className="py-2 pr-3 text-muted-foreground align-top leading-snug">{row.response}</td>
                <td className="py-2 pr-2 align-top">
                  <ClaimStateBadge state={row.claim_state} showLabel={false} />
                </td>
                <td className="py-2 align-top">
                  <FitBadge fit={row.fit} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// scatter — two-variable correlation
// ---------------------------------------------------------------------------

function ScatterBlock({ block }: { block: VisualBlock }) {
  const d = block.data as ScatterData;
  if (!d?.points?.length) return null;

  const option: EChartsOption = {
    backgroundColor: "transparent",
    grid: { left: "12%", right: "5%", top: "10%", bottom: "18%" },
    xAxis: {
      name: d.x_label ?? "x",
      nameLocation: "middle",
      nameGap: 20,
      nameTextStyle: { color: "#94a3b8", fontSize: 9 },
      axisLabel: { color: "#94a3b8", fontSize: 9 },
      splitLine: { lineStyle: { color: "#374151" } },
    },
    yAxis: {
      name: d.y_label ?? "y",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: "#94a3b8", fontSize: 9 },
      axisLabel: { color: "#94a3b8", fontSize: 9 },
      splitLine: { lineStyle: { color: "#374151" } },
    },
    tooltip: {
      formatter: (p: unknown) => {
        const params = p as { data: [number, number, string] };
        return `${params.data[2] ?? ""}<br/>x: ${params.data[0]}, y: ${params.data[1]}`;
      },
    },
    series: [{
      type: "scatter",
      data: d.points.map((p) => [p.x, p.y, p.label]),
      itemStyle: { color: "#6366f1", opacity: 0.8 },
      symbolSize: 8,
    }],
  };

  return (
    <BlockShell title={block.title}>
      <EChartsChart option={option} style={{ height: "180px", width: "100%" }} />
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// bar — simple categorical bar
// ---------------------------------------------------------------------------

function BarBlock({ block }: { block: VisualBlock }) {
  const d = block.data as BarData;
  if (!d?.items?.length) return null;

  return (
    <BlockShell title={block.title}>
      <ResponsiveContainer width="100%" height={Math.max(80, d.items.length * 24)}>
        <BarChart layout="vertical" data={d.items} margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={90}
            tick={{ fontSize: 9, fill: "#94a3b8" }}
          />
          <Tooltip contentStyle={{ fontSize: 10 }} />
          <Bar dataKey="value" fill="#6366f1" radius={[0, 3, 3, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// area_line — time series
// ---------------------------------------------------------------------------

function AreaLineBlock({ block }: { block: VisualBlock }) {
  const d = block.data as AreaLineData;
  if (!d?.points?.length) return null;

  const isArea = d.type !== "line";

  return (
    <BlockShell title={block.title}>
      <ResponsiveContainer width="100%" height={120}>
        {isArea ? (
          <AreaChart data={d.points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={d.x} tick={{ fontSize: 9, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey={d.y} fill="#6366f1" fillOpacity={0.25} stroke="#6366f1" strokeWidth={1.5} />
          </AreaChart>
        ) : (
          <AreaChart data={d.points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={d.x} tick={{ fontSize: 9, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey={d.y} fill="transparent" stroke="#6366f1" strokeWidth={1.5} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export function BlockRenderer({
  block,
  className,
  showcase = false,
}: {
  block: VisualBlock;
  className?: string;
  showcase?: boolean;
}) {
  const inner = (() => {
    switch (block.type) {
      case "domain_heatmap":     return <DomainHeatmapBlock block={block} />;
      case "knowledge_graph":    return <KnowledgeGraphBlock block={block} showcase={showcase} />;
      case "options_comparison": return <OptionsComparisonBlock block={block} />;
      case "evidence_bar":       return <EvidenceBarBlock block={block} />;
      case "radar":              return <RadarBlock block={block} />;
      case "npv_waterfall":      return <NpvWaterfallBlock block={block} />;
      case "gap_matrix":         return <GapMatrixBlock block={block} />;
      case "sankey":             return <SankeyBlock block={block} />;
      case "scatter":            return <ScatterBlock block={block} />;
      case "bar":                return <BarBlock block={block} />;
      case "area_line":          return <AreaLineBlock block={block} />;
      default:                   return null;
    }
  })();

  if (!inner) return null;
  return <div className={cn("w-full", className)}>{inner}</div>;
}

// ---------------------------------------------------------------------------
// BlocksView — full art director output (recommendation + blocks + citations)
// ---------------------------------------------------------------------------

export function BlocksView({
  blocks,
  verdict,
  showcase = false,
}: {
  blocks: VisualBlock[];
  verdict?: string;
  showcase?: boolean;
}) {
  if (!blocks.length && !verdict) return null;

  return (
    <div className={cn("space-y-3", showcase && "space-y-5")}>
      {verdict && (
        <p className="text-sm font-semibold text-foreground leading-snug px-1">{verdict}</p>
      )}
      {blocks.map((block, i) => (
        <BlockRenderer key={`${block.type}-${i}`} block={block} showcase={showcase} />
      ))}
    </div>
  );
}
