"use client";

/**
 * FiveCaseFlow — HM Treasury Five Case Model rendered with @xyflow/react.
 *
 * Demonstrates @xyflow for structured DAGs vs the static SVG currently in use.
 * Fully interactive: pan, zoom, click nodes.
 *
 * Five Case structure:
 *   Strategic ──► Economic ──► Commercial
 *                    │               │
 *                    ▼               ▼
 *                Financial      Management
 */

import { ReactFlow, Background, Controls, BackgroundVariant, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const NODE_BASE = {
  style: {
    fontSize: 11,
    borderRadius: 6,
    padding: "6px 12px",
    width: 130,
    textAlign: "center" as const,
    fontFamily: "Geist, ui-sans-serif, sans-serif",
    cursor: "default",
  },
};

const NODES: Node[] = [
  {
    id: "strategic",
    position: { x: 0, y: 0 },
    data: { label: "Strategic Case" },
    style: { ...NODE_BASE.style, background: "rgba(99,102,241,0.15)", border: "1.5px solid #6366f1", color: "#a5b4fc" },
  },
  {
    id: "economic",
    position: { x: 170, y: 0 },
    data: { label: "Economic Case" },
    style: { ...NODE_BASE.style, background: "rgba(139,92,246,0.15)", border: "1.5px solid #8b5cf6", color: "#c4b5fd" },
  },
  {
    id: "commercial",
    position: { x: 340, y: 0 },
    data: { label: "Commercial Case" },
    style: { ...NODE_BASE.style, background: "rgba(14,165,233,0.15)", border: "1.5px solid #0ea5e9", color: "#7dd3fc" },
  },
  {
    id: "financial",
    position: { x: 170, y: 100 },
    data: { label: "Financial Case" },
    style: { ...NODE_BASE.style, background: "rgba(16,185,129,0.15)", border: "1.5px solid #10b981", color: "#6ee7b7" },
  },
  {
    id: "management",
    position: { x: 340, y: 100 },
    data: { label: "Management Case" },
    style: { ...NODE_BASE.style, background: "rgba(245,158,11,0.15)", border: "1.5px solid #f59e0b", color: "#fcd34d" },
  },
];

const EDGE_STYLE = { stroke: "#4b5563", strokeWidth: 1.5 };
const EDGES: Edge[] = [
  { id: "se", source: "strategic",  target: "economic",   style: EDGE_STYLE, type: "smoothstep" },
  { id: "ec", source: "economic",   target: "commercial", style: EDGE_STYLE, type: "smoothstep" },
  { id: "ef", source: "economic",   target: "financial",  style: EDGE_STYLE, type: "smoothstep" },
  { id: "cm", source: "commercial", target: "management", style: EDGE_STYLE, type: "smoothstep" },
];

export function FiveCaseFlow({ className }: { className?: string }) {
  return (
    <div className={className ?? "h-[220px] w-full"}>
      <ReactFlow
        nodes={NODES}
        edges={EDGES}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.5}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        className="bg-transparent"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#1e293b" />
        <Controls
          showInteractive={false}
          className="!bg-card !border-border [&_button]:!text-muted-foreground [&_button:hover]:!text-foreground"
        />
      </ReactFlow>
    </div>
  );
}
