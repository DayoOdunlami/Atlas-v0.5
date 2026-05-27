"use client";

/**
 * G2VennChart — AntV G2 v5 Venn / Euler diagram.
 *
 * Uses the official @antv/g2 `venn` data transform which:
 *   1. Runs a force-simulation-based layout algorithm
 *   2. Computes exact SVG path geometry for each set region (circles AND crescent shapes)
 *   3. Places labels with `overlapDodgeY` to resolve collisions automatically
 *
 * Supports 2-set, 3-set, and multi-set Venns. Recommended max: 4 sets.
 *
 * Props:
 *   data      — VennSet[] with single-set and intersection rows
 *   variant   — 'filled' (default) | 'hollow' (border-only, print-friendly)
 *   theme     — 'dark' (default) | 'light'
 *   height    — pixel height (default 260)
 *
 * Data format: identical to VennDiagram — { sets: string[], size: number, label?: string }
 *
 * @antv/g2 is already installed (~600 kB), no new dependency.
 */

import { useEffect, useRef } from "react";

import type { VennSet } from "./venn-diagram";

export interface G2VennChartProps {
  data: VennSet[];
  className?: string;
  height?: number;
  /** 'filled' = solid circles with opacity; 'hollow' = border-only rings */
  variant?: "filled" | "hollow";
  /** 'dark' matches lab dark canvas; 'light' matches recipe cards */
  theme?: "dark" | "light";
}

// ── Colour palettes ─────────────────────────────────────────────────────────

const PALETTE_DARK = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
];

const PALETTE_LIGHT = [
  "#4f46e5", // indigo-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#0891b2", // cyan-600
];

// ── Component ────────────────────────────────────────────────────────────────

export function G2VennChart({
  data,
  className,
  height = 260,
  variant = "filled",
  theme = "dark",
}: G2VennChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Stringify data for stable dep comparison — G2 chart is destroyed + recreated
  // on any change so we need a value-stable key, not reference-stable.
  const dataKey = JSON.stringify(data);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || data.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;
    let cancelled = false;

    const palette = theme === "dark" ? PALETTE_DARK : PALETTE_LIGHT;
    const labelFill = theme === "dark" ? "#f8fafc" : "#1e293b";
    const labelBg =
      theme === "dark" ? "rgba(8,12,28,0.82)" : "rgba(255,255,255,0.88)";
    const strokeColor =
      theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";

    // Build labelled data: single-set → "Name (N)"; intersection → count
    const labelledData = data.map((d) => ({
      ...d,
      label:
        d.label ??
        (d.sets.length === 1
          ? `${d.sets[0]} (${d.size})`
          : String(d.size)),
    }));

    import("@antv/g2")
      .then(({ Chart }) => {
        if (cancelled || !el) return;
        el.innerHTML = "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chart = new (Chart as any)({
          container: el,
          autoFit: true,
          height,
          theme: theme === "dark" ? "dark" : "light",
          padding: "auto",
        });

        chart.options({
          type: "path",
          data: {
            type: "inline",
            value: labelledData,
            transform: [
              {
                type: "venn",
                // padding prevents circle edges being clipped at container boundary
                padding: 16,
              },
            ],
          },
          encode: {
            d: "path",
            color: "key",
            // hollow variant: border-only rings, no fill
            ...(variant === "hollow" ? { shape: "hollow" } : {}),
          },
          scale: {
            color: { range: palette },
          },
          labels: [
            {
              position: "inside",
              text: (d: Record<string, unknown>) => {
                const label = d["label"];
                return label != null ? String(label) : "";
              },
              style: {
                fontSize: 11,
                fontWeight: "700",
                fontFamily: "Geist, ui-sans-serif, sans-serif",
                fill: variant === "hollow" ? (theme === "dark" ? "#e2e8f0" : "#1e293b") : labelFill,
                // Dark pill backing for readability on any fill colour
                background: variant === "filled",
                backgroundFill: labelBg,
                backgroundRadius: 4,
                backgroundPadding: [3, 8],
              },
              // overlapDodgeY physically moves colliding labels apart vertically —
              // prevents the "56 7 18 22" pile-up when overlaps are high.
              transform: [{ type: "overlapDodgeY" }],
            },
          ],
          style:
            variant === "hollow"
              ? {
                  // Hollow: transparent fill, coloured border
                  fillOpacity: 0,
                  lineWidth: 3,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  opacity: (d: any) =>
                    Array.isArray(d?.sets) && d.sets.length > 1 ? 0.5 : 0.85,
                }
              : {
                  // Filled: solid circles, translucent intersection paths
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  opacity: (d: any) =>
                    Array.isArray(d?.sets) && d.sets.length > 1 ? 0.35 : 0.72,
                  stroke: strokeColor,
                  lineWidth: 1.5,
                },
          tooltip: {
            items: [
              { name: "Set", field: "key" },
              { name: "Count", field: "size" },
            ],
          },
          state: {
            active: { opacity: 0.92, lineWidth: 2.5, stroke: "#fff" },
            inactive: { opacity: 0.12 },
          },
          interactions: [{ type: "elementHighlight" }],
          legend: false,
        });

        chart
          .render()
          .catch((err: unknown) =>
            console.warn("[G2VennChart] render error:", err),
          );
      })
      .catch((err: unknown) =>
        console.error("[G2VennChart] load error:", err),
      );

    return () => {
      cancelled = true;
      try {
        chart?.destroy();
      } catch (_) {
        /* ignore */
      }
    };
    // dataKey is a stable JSON string — chart fully rebuilds when data changes.
    // height/variant/theme are primitive props so standard dep comparison works.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, height, variant, theme]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height, background: "transparent" }}
    />
  );
}
