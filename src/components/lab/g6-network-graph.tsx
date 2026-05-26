"use client";

/**
 * G6NetworkGraph — AntV G6 v5 force-directed network graph.
 *
 * Comparison target: shows the same knowledge graph data as the ECharts force
 * graph so the Lab can evaluate both side-by-side on layout quality, interactivity,
 * and bundle cost (~900 kB G6 vs ~1.3 MB ECharts full build).
 *
 * G6 v5 API (no React wrapper — @antv/react-g6 targets v4):
 *   const graph = new Graph({ container, data, layout, node, edge })
 *   graph.render()                  → async, returns Promise<void>
 *   graph.destroy()                 → cleanup on unmount
 */

import { useEffect, useRef } from "react";

export interface G6Node {
  id: string;
  label?: string;
  size?: number;
  color?: string;
  category?: string;
}

export interface G6Edge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
}

interface G6NetworkGraphProps {
  nodes: G6Node[];
  edges: G6Edge[];
  className?: string;
  height?: number;
}

// Atlas colour palette indexed by category
const CAT_COLORS: Record<string, string> = {
  project:   "#6366f1",
  theme:     "#10b981",
  funder:    "#f59e0b",
  mode:      "#06b6d4",
  default:   "#8b5cf6",
};

/**
 * G6NetworkGraph — renders a force-directed network graph using AntV G6 v5.
 *
 * Dynamically imports G6 (avoids SSR crash — G6 manipulates the DOM directly).
 * Pass a new `key` prop to force remount when data changes.
 */
export function G6NetworkGraph({ nodes, edges, className, height = 260 }: G6NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || nodes.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let graph: any = null;
    let cancelled = false;

    import("@antv/g6")
      .then(({ Graph }) => {
        if (cancelled || !el) return;
        el.innerHTML = "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        graph = new (Graph as any)({
          container: el,
          width: el.clientWidth || 480,
          height,
          autoFit: "view",
          data: {
            nodes: nodes.map((n) => ({
              id: n.id,
              data: {
                label: n.label ?? n.id,
                category: n.category ?? "default",
              },
              style: {
                size: n.size ?? 24,
                fill: n.color ?? CAT_COLORS[n.category ?? "default"] ?? CAT_COLORS.default,
                fillOpacity: 0.85,
                stroke: "rgba(255,255,255,0.15)",
                lineWidth: 1,
                labelFill: "#e2e8f0",
                labelFontSize: 10,
                labelFontFamily: "Geist, ui-sans-serif, sans-serif",
                labelPlacement: "bottom",
                labelOffsetY: 4,
              },
            })),
            edges: edges.map((e, i) => ({
              id: `e${i}`,
              source: e.source,
              target: e.target,
              data: { label: e.label ?? "", weight: e.weight ?? 1 },
              style: {
                stroke: "#334155",
                lineWidth: Math.max(1, (e.weight ?? 1) * 1.5),
                strokeOpacity: 0.6,
                endArrow: false,
              },
            })),
          },
          layout: {
            type: "force",
            preventOverlap: true,
            nodeSize: 28,
            linkDistance: 80,
            nodeStrength: -200,
            edgeStrength: 0.6,
            alphaDecay: 0.028,
          },
          behaviors: ["drag-canvas", "zoom-canvas", "drag-element"],
          background: "transparent",
        });

        graph.render().catch((err: unknown) =>
          console.warn("[G6NetworkGraph] render error:", err),
        );
      })
      .catch((err: unknown) => console.error("[G6NetworkGraph] load error:", err));

    return () => {
      cancelled = true;
      try {
        graph?.destroy();
      } catch (_) {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height, background: "transparent" }}
    />
  );
}
