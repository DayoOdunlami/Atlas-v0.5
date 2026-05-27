"use client";

/**
 * AntvMcpChart — calls the AntV MCP server API to generate a chart image.
 *
 * The @antv/mcp-server-chart tool POSTs a chart spec to Alipay's render
 * service (https://antv-studio.alipay.com/api/gpt-vis) and returns a PNG
 * image URL. This component calls our proxy Next.js route rather than
 * hitting Alipay directly from the browser (avoids CORS, keeps the service
 * URL server-side).
 *
 * USE CASES:
 *   - Static brief artifacts where an image PNG is acceptable
 *   - Agent-generated charts where the LLM emits a GPT-vis spec
 *   - Quick comparison: does the cloud render look better than the local G2?
 *
 * TRADE-OFFS vs local G2:
 *   + Zero client bundle cost (image URL, not JS library)
 *   + 26 chart types including some not in G2 core (word cloud, liquid, violin)
 *   - Not interactive (static PNG — no hover, no drill-down)
 *   - External service dependency (Alipay infra)
 *   - ~500ms latency per render
 *   - Requires VIS_REQUEST_SERVER env var override for self-hosted / production
 *
 * Proxy route: /api/atlas5/antv-mcp-render (server-side POST → Alipay API)
 */

import { useEffect, useState } from "react";

export interface AntvMcpSpec {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface AntvMcpChartProps {
  spec: AntvMcpSpec;
  className?: string;
  height?: number;
  alt?: string;
}

type RenderState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; imageUrl: string }
  | { status: "error"; message: string };

export function AntvMcpChart({
  spec,
  className,
  height = 260,
  alt = "AntV MCP chart",
}: AntvMcpChartProps) {
  const [state, setState] = useState<RenderState>({ status: "idle" });

  useEffect(() => {
    setState({ status: "loading" });
    let cancelled = false;

    fetch("/api/atlas5/antv-mcp-render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    })
      .then((r) => r.json())
      .then((data: { imageUrl?: string; error?: string }) => {
        if (cancelled) return;
        if (data.imageUrl) {
          setState({ status: "ok", imageUrl: data.imageUrl });
        } else {
          setState({ status: "error", message: data.error ?? "Render failed" });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "Fetch failed",
          });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div
        className={`flex items-center justify-center text-xs text-muted-foreground animate-pulse ${className ?? ""}`}
        style={{ height }}
      >
        Rendering via AntV MCP…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 ${className ?? ""}`}
        style={{ height }}
      >
        <span className="text-xs text-destructive">AntV MCP error</span>
        <span className="text-xs text-muted-foreground font-mono">{state.message}</span>
        <span className="text-xs text-muted-foreground mt-1">
          Set VIS_REQUEST_SERVER env var to override Alipay endpoint.
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={state.imageUrl}
      alt={alt}
      className={className}
      style={{ width: "100%", height, objectFit: "contain" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Pre-built spec builders for common Atlas use cases
// ---------------------------------------------------------------------------

/**
 * Build a Venn chart spec for the AntV MCP server.
 * Data format: same VennSet[] shape used by VennDiagram + G2VennChart.
 */
/**
 * Build a Venn chart spec for the AntV MCP server.
 * NOTE: AntV MCP uses `value` (not `size`) as the numeric field.
 * Data format: VennSet shape { sets, size } — we map size → value here.
 */
export function buildMcpVennSpec(
  data: Array<{ sets: string[]; size: number; label?: string }>,
  title = "Theme Intersections",
): AntvMcpSpec {
  return {
    type: "venn",
    title,
    // AntV MCP venn schema: { label?: string, value: number, sets: string[] }
    data: data.map((d) => ({
      sets: d.sets,
      value: d.size,                                          // size → value
      label: d.label ?? (d.sets.length === 1 ? d.sets[0] : String(d.size)),
    })),
  };
}

/**
 * Build a Sankey chart spec for the AntV MCP server.
 */
export function buildMcpSankeySpec(
  nodes: Array<{ id: string; name: string }>,
  links: Array<{ source: string; target: string; value: number }>,
  title = "Flow",
): AntvMcpSpec {
  return { type: "sankey", title, nodes, links };
}

/**
 * Build a heatmap spec for the AntV MCP server.
 */
export function buildMcpHeatmapSpec(
  data: Array<{ x: string; y: string; value: number }>,
  title = "Heatmap",
): AntvMcpSpec {
  return { type: "heatmap", title, data };
}

/**
 * Build a network graph spec for the AntV MCP server.
 */
export function buildMcpNetworkSpec(
  nodes: Array<{ id: string; name: string; category?: string }>,
  edges: Array<{ source: string; target: string; label?: string }>,
  title = "Knowledge Graph",
): AntvMcpSpec {
  return { type: "network_graph", title, nodes, edges };
}

/**
 * Build a radar chart spec for the AntV MCP server.
 */
export function buildMcpRadarSpec(
  indicators: Array<{ name: string; max?: number }>,
  series: Array<{ name: string; values: number[] }>,
  title = "Radar",
): AntvMcpSpec {
  return { type: "radar", title, indicators, series };
}

/**
 * Build a treemap spec for the AntV MCP server.
 */
export function buildMcpTreemapSpec(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  title = "Treemap",
): AntvMcpSpec {
  return { type: "treemap", title, data };
}

/**
 * Build a word cloud spec for the AntV MCP server.
 * (No local equivalent — exclusive to AntV MCP.)
 */
export function buildMcpWordCloudSpec(
  words: Array<{ text: string; value: number }>,
  title = "Word Cloud",
): AntvMcpSpec {
  return { type: "word_cloud", title, data: words };
}
