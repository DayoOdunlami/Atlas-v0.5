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
              // G6 v5: label text lives in style.labelText, NOT data.label
              style: {
                size: n.size ?? 24,
                fill: n.color ?? CAT_COLORS[n.category ?? "default"] ?? CAT_COLORS.default,
                fillOpacity: 0.85,
                stroke: "rgba(255,255,255,0.18)",
                lineWidth: 1,
                // ── Label properties (G6 v5 prefixed form) ──────────────────
                labelText: n.label ?? n.id,
                labelFill: "#e2e8f0",
                labelFontSize: 11,
                labelFontFamily: "Geist, ui-sans-serif, sans-serif",
                labelFontWeight: "500",
                labelPlacement: "bottom",
                labelOffsetY: 4,
                // Translucent pill behind each label so it reads on any bg
                labelBackgroundFill: "rgba(15,23,42,0.65)",
                labelBackgroundRadius: 3,
                labelPadding: [2, 5],
              },
            })),
            edges: edges.map((e, i) => ({
              id: `e${i}`,
              source: e.source,
              target: e.target,
              style: {
                stroke: "#475569",
                lineWidth: Math.max(1, (e.weight ?? 1) * 1.2),
                strokeOpacity: 0.55,
                endArrow: false,
              },
            })),
          },
          layout: {
            type: "force",
            // Prevent circles from sitting on top of each other
            preventOverlap: true,
            // nodeSize + nodeSpacing together determine the exclusion zone
            nodeSize: 32,
            nodeSpacing: 16,
            // Stronger repulsion — default D3 charge is −30; −350 gives visible spread
            nodeStrength: -350,
            linkDistance: 110,
            edgeStrength: 0.35,
            // Slow cool-down so the layout has time to settle
            alphaDecay: 0.018,
            // Gentle gravity pulls the cluster back to center
            gravity: 0.08,
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
