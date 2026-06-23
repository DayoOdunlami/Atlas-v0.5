"use client";

import type { EChartsOption } from "echarts";
import { lazy, Suspense, useMemo } from "react";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

const ReactECharts = lazy(() => import("echarts-for-react"));

type NetworkNode = {
  id: string;
  label: string;
  group?: string;
  x?: number;
  y?: number;
  source?: string;
};

type NetworkEdge = {
  source: string;
  target: string;
  weight?: number;
  trust?: string;
};

type NetworkInstrumentData = {
  nodes?: NetworkNode[];
  edges?: NetworkEdge[];
  ladderRung?: string;
  edgeDensity?: number;
  layout?: string;
};

const GROUP_COLOR: Record<string, string> = {
  mode: "#3E6B8C",
  org: "#3F7A52",
  funder: "#B07A2E",
};

function buildLightGraphOption(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  layout: "none" | "force",
): EChartsOption {
  const categories = ["mode", "org", "funder"].map((name) => ({
    name,
    itemStyle: { color: GROUP_COLOR[name] },
  }));

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (p: unknown) => {
        const params = p as {
          dataType: string;
          data: {
            name: string;
            category?: number;
            value?: number;
            source?: string;
            target?: string;
          };
        };
        if (params.dataType === "edge") {
          const w = params.data.value;
          return `${params.data.source} → ${params.data.target}${w != null ? `<br/>weight: ${w}` : ""}<br/><span style="color:#3F7A52">corpus</span>`;
        }
        const cat = categories[params.data.category ?? 0]?.name ?? "";
        return `<b>${params.data.name}</b>${cat ? `<br/>${cat}` : ""}`;
      },
    },
    series: [
      {
        type: "graph",
        layout,
        roam: true,
        data: nodes.map((n) => ({
          id: n.id,
          name: n.label.length > 28 ? `${n.label.slice(0, 26)}…` : n.label,
          x: n.x,
          y: n.y,
          category: ["mode", "org", "funder"].indexOf(n.group ?? "mode"),
          symbolSize: n.group === "mode" ? 36 : 22,
          itemStyle: {
            color: GROUP_COLOR[n.group ?? "mode"] ?? "#56524C",
            borderColor: "#fff",
            borderWidth: 1,
          },
          label: {
            show: true,
            color: "#46423C",
            fontSize: 10,
            fontFamily: atlasFont.sans,
          },
        })),
        links: edges.map((e) => ({
          source: e.source,
          target: e.target,
          value: e.weight,
          lineStyle: {
            color: e.trust === "web" ? T.web : "#3F7A52",
            width: Math.max(1, Math.min(6, (e.weight ?? 1) * 0.8)),
            type: e.trust === "web" ? "dashed" : "solid",
            opacity: 0.75,
          },
        })),
        categories,
        emphasis: { focus: "adjacency" },
        ...(layout === "force"
          ? {
              force: {
                repulsion: 120,
                gravity: 0.08,
                edgeLength: 90,
              },
            }
          : {}),
      },
    ],
  };
}

export function NetworkMap({
  instrument,
}: {
  instrument: NonNullable<AnswerSpec["instrument"]>;
}) {
  const data = instrument.data as NetworkInstrumentData;
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const ladderRung = data.ladderRung ?? "typed-inventory";
  const honestyLabel = instrument.honesty?.label ?? "density-honest";
  const useInventoryOnly = ladderRung === "typed-inventory" && edges.length < 2;

  const option = useMemo(() => {
    if (useInventoryOnly || nodes.length === 0) return null;
    const hasCoords = nodes.every((n) => n.x != null && n.y != null);
    const layout = data.layout === "none" && hasCoords ? "none" : "force";
    return buildLightGraphOption(nodes, edges, layout);
  }, [data.layout, edges, nodes, useInventoryOnly]);

  return (
    <div data-testid="network-map" className="mb-4 max-w-[720px]">
      <div className="mb-3 flex items-baseline justify-between">
        <div
          className="uppercase"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "#56524C",
          }}
        >
          Cross-modal bridges · drawn honest-to-density
        </div>
        <div style={{ fontFamily: atlasFont.mono, fontSize: 9, color: T.inkFaint }}>
          {ladderRung} · {honestyLabel}
        </div>
      </div>

      {useInventoryOnly ? (
        <div
          className="rounded-lg border px-4 py-3"
          style={{ borderColor: "#EFEBE4", background: "#FFFFFF" }}
        >
          <p
            className="mb-3"
            style={{ fontFamily: atlasFont.mono, fontSize: 9, color: T.inkFaint }}
          >
            Typed inventory — nodes without fabricated edges
          </p>
          <div className="flex flex-wrap gap-2">
            {nodes.map((n) => (
              <span
                key={n.id}
                className="rounded-full border px-2.5 py-1 text-xs"
                style={{
                  borderColor: "#CFE0D4",
                  background: "#F4F8F4",
                  color: "#2F5C3E",
                }}
              >
                {n.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-lg border"
          style={{ height: 266, borderColor: "#EFEBE4", background: "#FFFFFF" }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage: "radial-gradient(circle, #F2EFE9 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          {option ? (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-xs text-[#A39E96]">
                  Loading graph…
                </div>
              }
            >
              <ReactECharts
                option={option}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "canvas" }}
              />
            </Suspense>
          ) : null}
        </div>
      )}

      <p
        className="mt-2 leading-relaxed"
        style={{ fontFamily: atlasFont.mono, fontSize: 9, color: "#94908A" }}
      >
        ladder: force-graph → ego-network → inventory → matrix · {nodes.length} nodes ·{" "}
        {edges.length} edges
        {data.edgeDensity != null ? ` · ρ=${data.edgeDensity}` : ""}
      </p>
    </div>
  );
}
