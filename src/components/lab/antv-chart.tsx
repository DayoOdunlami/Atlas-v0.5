"use client";

/**
 * AntVChart — React wrapper for AntV G2 v5.
 *
 * Why AntV G2?
 *   Venn / Euler diagrams — genuinely exclusive. Recharts, Vega-Lite, and
 *   ECharts have no native Venn mark. Atlas use case: "Which projects span
 *   both freight decarbonisation AND EV charging?" Set intersection visible
 *   at a glance — that's impossible in the other three frameworks.
 *
 * IMPORTANT: In G2 v5.4.x, Venn is NOT a mark — it is a data transform
 * (data.venn). The correct API is chart.path() + transform: [{ type: 'venn' }].
 * There is no chart.venn() method.
 */

import { useEffect, useRef } from "react";

// Atlas colour palette — must match CSS --chart-* vars
export const ANTV_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AntVSpecFn = (chart: any) => void;

interface AntVChartProps {
  spec: AntVSpecFn;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * AntVChart — mounts an AntV G2 v5 chart via dynamic import (avoids SSR crash).
 *
 * The chart is created on mount, spec runs once, destroyed on unmount.
 * Pass a different `key` prop from the parent to force remount on data change.
 */
export function AntVChart({ spec, style, className }: AntVChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;
    let cancelled = false;
    const h = typeof style?.height === "number" ? style.height : 220;

    import("@antv/g2")
      .then(({ Chart }) => {
        if (cancelled || !el) return;
        el.innerHTML = "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chart = new (Chart as any)({
          container: el,
          autoFit: true,
          height: h,
          // Transparent background so our dark card bg shows through
          theme: { background: "transparent" },
        });

        spec(chart);
        chart.render();
      })
      .catch((err: unknown) => console.error("[AntVChart] load error:", err));

    return () => {
      cancelled = true;
      try {
        chart?.destroy();
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
      style={{ width: "100%", background: "transparent", ...style }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared axis/label styles for dark UI
// ─────────────────────────────────────────────────────────────────────────────

const DARK_AXIS_X = {
  labelFontSize: 10,
  labelFill: "#94a3b8",
  tickStroke: "transparent",
  lineStroke: "#4b5563",
  labelAutoRotate: true,
};
const DARK_AXIS_Y = {
  labelFontSize: 10,
  labelFill: "#94a3b8",
  gridStroke: "#1e293b",
  gridStrokeOpacity: 1,
  lineStroke: "transparent",
};

// ─────────────────────────────────────────────────────────────────────────────
// Venn / Euler diagram
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VennSet — one circle or intersection in a Venn / Euler diagram.
 *
 * { sets: ['A'] }           → full circle for set A
 * { sets: ['A', 'B'] }      → intersection of A and B
 * { sets: ['A', 'B', 'C'] } → triple intersection
 */
export interface VennSet {
  sets: string[];
  size: number;
  label?: string;
}

/**
 * buildAntVVennSpec — Venn / Euler diagram using the G2 v5 venn data transform.
 *
 * In G2 v5.4.x, Venn is NOT a mark. It is a data.venn transform that computes
 * SVG path geometry from sets + sizes. The paths are then rendered as a
 * chart.path() mark with encode('shape', 'path') + encode('color', 'key').
 *
 * The transform outputs:
 *   key:  sets.join('&')  — used for color + tooltip
 *   path: (dims) => svgPathString  — computed circle/intersection geometry
 */
export function buildAntVVennSpec(data: VennSet[]): AntVSpecFn {
  return (chart) => {
    chart
      .path()
      .data({
        type: "inline",
        value: data,
        transform: [{ type: "venn" }],
      })
      .encode("shape", "path")
      .encode("color", "key")
      .scale("color", {
        type: "ordinal",
        range: ANTV_COLORS,
      })
      .style({
        fillOpacity: 0.32,
        stroke: "#1e293b",
        strokeWidth: 1.5,
      })
      .label([
        {
          // Primary label inside each circle / intersection
          text: (d: { key: string; label?: string }) =>
            d.label ?? d.key.replace(/&/g, "\n∩ "),
          style: {
            fontSize: 10,
            fill: "#f8fafc",
            fontFamily: "Geist, ui-sans-serif, sans-serif",
            textAlign: "center",
          },
          position: "inside",
        },
      ])
      .tooltip({
        items: [
          {
            field: "key",
            name: "Theme(s)",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            transform: (v: any) => String(v).replace(/&/g, " ∩ "),
          },
          { field: "size", name: "Projects" },
        ],
      })
      .legend("color", {
        position: "bottom",
        itemLabelFill: "#94a3b8",
        itemLabelFontSize: 10,
      });
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard chart types (for bake-off comparison)
// ─────────────────────────────────────────────────────────────────────────────

/** Bar — bake-off equivalent of Recharts <BarChart> */
export function buildAntVBarSpec(
  data: Array<Record<string, string | number>>,
  xKey: string,
  yKey: string,
): AntVSpecFn {
  return (chart) => {
    chart
      .interval()
      .data(data)
      .encode("x", xKey)
      .encode("y", yKey)
      .encode("color", xKey)
      .scale("color", { type: "ordinal", range: ANTV_COLORS })
      .style({ radius: 4 })
      .axis("x", DARK_AXIS_X)
      .axis("y", DARK_AXIS_Y)
      .legend(false)
      .tooltip({ items: [{ field: xKey }, { field: yKey }] });
  };
}

/** Area / Line — bake-off equivalent of Recharts <AreaChart> */
export function buildAntVAreaSpec(
  data: Array<Record<string, string | number>>,
  xKey: string,
  yKey: string,
): AntVSpecFn {
  return (chart) => {
    chart
      .area()
      .data(data)
      .encode("x", xKey)
      .encode("y", yKey)
      .style({
        fill: "#6366f1",
        fillOpacity: 0.22,
        stroke: "#6366f1",
        lineWidth: 2.5,
      })
      .axis("x", DARK_AXIS_X)
      .axis("y", DARK_AXIS_Y)
      .legend(false)
      .tooltip({ items: [{ field: xKey }, { field: yKey }] });
  };
}

/** Stacked bar — bake-off equivalent of Recharts stacked bar */
export function buildAntVStackedBarSpec(
  data: Array<{ funder: string; status: string; count: number }>,
): AntVSpecFn {
  return (chart) => {
    chart
      .interval()
      .data(data)
      .transform([{ type: "stackY" }])
      .encode("x", "funder")
      .encode("y", "count")
      .encode("color", "status")
      .scale("color", {
        type: "ordinal",
        domain: ["open", "closed"],
        range: ["#10b981", "#6366f1"],
      })
      .style({ radius: 4 })
      .axis("x", DARK_AXIS_X)
      .axis("y", DARK_AXIS_Y)
      .legend("color", {
        position: "bottom",
        itemLabelFill: "#94a3b8",
        itemLabelFontSize: 10,
      })
      .tooltip({ items: [{ field: "funder" }, { field: "status" }, { field: "count" }] });
  };
}

/** Pie / Donut — bake-off equivalent of Recharts <PieChart> */
export function buildAntVPieSpec(
  data: Array<Record<string, string | number>>,
  nameKey: string,
  valueKey: string,
): AntVSpecFn {
  return (chart) => {
    chart.coordinate({ type: "theta", innerRadius: 0.4 });
    chart
      .interval()
      .data(data)
      .transform([{ type: "stackY" }])
      .encode("y", valueKey)
      .encode("color", nameKey)
      .scale("color", { type: "ordinal", range: ANTV_COLORS })
      .style({ strokeWidth: 1, stroke: "transparent" })
      .legend("color", {
        position: "bottom",
        itemLabelFill: "#94a3b8",
        itemLabelFontSize: 10,
      })
      .tooltip({
        items: [{ field: nameKey, name: "Category" }, { field: valueKey, name: "Value" }],
      });
  };
}

/** Scatter — bake-off equivalent of Recharts <ScatterChart> */
export function buildAntVScatterSpec(
  data: Array<Record<string, string | number>>,
  xKey: string,
  yKey: string,
): AntVSpecFn {
  return (chart) => {
    chart
      .point()
      .data(data)
      .encode("x", xKey)
      .encode("y", yKey)
      .style({ fill: "#6366f1", fillOpacity: 0.75, r: 4 })
      .axis("x", { ...DARK_AXIS_X, gridStroke: "#1e293b" })
      .axis("y", DARK_AXIS_Y)
      .legend(false)
      .tooltip({ items: [{ field: xKey }, { field: yKey }] });
  };
}
