"use client";

/**
 * VennDiagram — pure SVG Venn / Euler diagram. Zero external dependencies.
 *
 * WHY NOT G2's venn?
 *   In @antv/g2 v5.4.x, "venn" is a DATA TRANSFORM (data.venn), not a mark.
 *   It outputs SVG path geometry as a function `({ width, height }) => string`
 *   which must be consumed via chart.path() + encode('shape', 'path'). This
 *   path is fragile to render and not well-documented. The SVG approach below
 *   is simpler, fully styled, and completely reliable.
 *
 * Supports 2 or 3 sets with pairwise + triple intersections.
 * Sizes sets by area (circle radius ∝ √size) so larger sets look larger.
 *
 * Atlas use case: theme × theme → "Which projects span BOTH freight AND EV?"
 *   Single circles = all projects in that theme
 *   Intersection = projects appearing in multiple themes
 */

import type { CSSProperties } from "react";

export interface VennSet {
  /** ["A"] = single set circle; ["A","B"] = intersection region */
  sets: string[];
  /** Projects in this set / intersection — drives circle area or label */
  size: number;
  /** Optional override label; defaults to sets[0] or count */
  label?: string;
}

interface VennDiagramProps {
  data: VennSet[];
  className?: string;
  style?: CSSProperties;
}

// Atlas colour palette — matches --chart-* CSS vars
const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

/**
 * VennDiagram — renders overlapping circles as an SVG Venn / Euler diagram.
 *
 * Data format:
 *   { sets: ['A'],       size: 47 }  → full circle for theme A, radius ∝ √47
 *   { sets: ['A','B'],   size: 9  }  → intersection label between A and B
 *   { sets: ['A','B','C'], size: 2 } → triple intersection label
 *
 * Pass a `key` to force remount when data changes.
 */
export function VennDiagram({ data, className, style }: VennDiagramProps) {
  const W = 420;
  const H = 260;
  const cx = W / 2;
  const cy = H / 2;

  const singles = data.filter((d) => d.sets.length === 1).slice(0, 3);
  const pairs   = data.filter((d) => d.sets.length === 2);
  const triple  = data.find((d) => d.sets.length === 3);

  const n = singles.length;
  if (n < 2) return null;

  // Scale radius by √size so area ∝ project count, with min/max clamp
  const maxSize = Math.max(...singles.map((s) => s.size), 1);
  const BASE_R = n === 2 ? 88 : 76;
  const getR = (size: number) =>
    Math.max(52, Math.min(BASE_R, BASE_R * Math.sqrt(size / maxSize) * 1.15));

  // Circle centres — 2 sets: side by side; 3 sets: equilateral triangle
  const centres = singles.map((_, i): { x: number; y: number } => {
    if (n === 2) {
      return i === 0
        ? { x: cx - BASE_R * 0.6, y: cy }
        : { x: cx + BASE_R * 0.6, y: cy };
    }
    const angle = (i * 120 - 90) * (Math.PI / 180);
    return {
      x: cx + Math.cos(angle) * BASE_R * 0.72,
      y: cy + Math.sin(angle) * BASE_R * 0.72,
    };
  });

  // Label anchor — pushed outward from the diagram centre
  const outerLabel = (i: number) => {
    const c = centres[i];
    const dx = c.x - cx;
    const dy = c.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const push = BASE_R * 0.75;
    return { x: c.x + (dx / len) * push, y: c.y + (dy / len) * push };
  };

  // Intersection label — centroid of relevant circles, nudged toward diagram centre
  const interLabel = (sets: string[]): { x: number; y: number } | null => {
    const idx = sets.map((s) => singles.findIndex((sg) => sg.sets[0] === s));
    if (idx.some((i) => i < 0)) return null;
    const avgX = idx.reduce((s, i) => s + centres[i].x, 0) / idx.length;
    const avgY = idx.reduce((s, i) => s + centres[i].y, 0) / idx.length;
    if (idx.length === 3) return { x: avgX, y: avgY };
    // 2-way: nudge toward diagram centre so label sits in the overlap zone
    const dx = cx - avgX;
    const dy = cy - avgY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      x: avgX + (dx / len) * BASE_R * 0.18,
      y: avgY + (dy / len) * BASE_R * 0.18,
    };
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ width: "100%", height: "100%", overflow: "visible", ...style }}
      role="img"
      aria-label="Venn diagram — theme intersections"
    >
      {/* Circles */}
      {singles.map((set, i) => (
        <circle
          key={`circle-${set.sets[0]}`}
          cx={centres[i].x}
          cy={centres[i].y}
          r={getR(set.size)}
          fill={PALETTE[i % PALETTE.length]}
          fillOpacity={0.2}
          stroke={PALETTE[i % PALETTE.length]}
          strokeWidth={1.5}
          strokeOpacity={0.65}
        />
      ))}

      {/* Theme name + count — pushed to outer edge of each circle */}
      {singles.map((set, i) => {
        const pos = outerLabel(i);
        return (
          <g key={`label-${set.sets[0]}`}>
            <text
              x={pos.x}
              y={pos.y - 8}
              textAnchor="middle"
              fontSize={11}
              fontWeight="600"
              fill={PALETTE[i % PALETTE.length]}
              fontFamily="Geist, ui-sans-serif, sans-serif"
            >
              {set.sets[0]}
            </text>
            <text
              x={pos.x}
              y={pos.y + 10}
              textAnchor="middle"
              fontSize={15}
              fill="#f8fafc"
              fontFamily="Geist, ui-sans-serif, sans-serif"
            >
              {set.size}
            </text>
          </g>
        );
      })}

      {/* Intersection counts — shown at centroid of overlapping area */}
      {[...pairs, ...(triple ? [triple] : [])].map((inter) => {
        const pos = interLabel(inter.sets);
        if (!pos) return null;
        const isTriple = inter.sets.length === 3;
        const displayText = String(inter.size);
        // Auto-size pill so 1- and 2-digit numbers both fit with padding
        const pillW = Math.max(28, displayText.length * 9 + 14);
        const pillH = 20;
        const tooltip = isTriple
          ? `${inter.sets.join(" ∩ ")} — ${inter.size} docs span all three themes`
          : `${inter.sets.join(" ∩ ")} — ${inter.size} docs span both themes`;
        return (
          <g key={`inter-${inter.sets.join("&")}`}>
            <title>{tooltip}</title>
            {/* Backing pill — wider so the count number breathes */}
            <rect
              x={pos.x - pillW / 2}
              y={pos.y - pillH / 2}
              width={pillW}
              height={pillH}
              rx={5}
              fill="rgba(10,15,30,0.75)"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={0.75}
            />
            <text
              x={pos.x}
              y={pos.y + 5}
              textAnchor="middle"
              fontSize={isTriple ? 11 : 13}
              fontWeight="700"
              fill="#f1f5f9"
              fontFamily="Geist, ui-sans-serif, sans-serif"
            >
              {displayText}
            </text>
          </g>
        );
      })}

      {/* Legend strip at bottom */}
      <g transform={`translate(${W / 2 - (singles.length * 100) / 2}, ${H - 28})`}>
        {singles.map((set, i) => (
          <g key={`leg-${set.sets[0]}`} transform={`translate(${i * 104}, 0)`}>
            <circle cx={6} cy={0} r={5} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.8} />
            <text x={14} y={4} fontSize={9} fill="#94a3b8" fontFamily="Geist, ui-sans-serif, sans-serif">
              {set.sets[0]}
            </text>
          </g>
        ))}
      </g>

      {/* Explanatory caption — tells user what the overlap numbers mean */}
      <text
        x={W / 2}
        y={H - 8}
        textAnchor="middle"
        fontSize={8.5}
        fill="#64748b"
        fontFamily="Geist, ui-sans-serif, sans-serif"
        fontStyle="italic"
      >
        Numbers in overlaps = docs spanning both themes · circle area = total count
      </text>
    </svg>
  );
}
