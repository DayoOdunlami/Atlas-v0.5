"use client";

/**
 * KnowledgeGraph — sample network graph using @xyflow/react (already installed).
 *
 * Shows a mini Atlas knowledge graph: themes → projects → funders.
 * This is the @xyflow/react proof-of-concept before choosing between:
 *   @xyflow/react  — manual layout, full React control, great for DAGs/flows
 *   AntV G6        — force-directed auto-layout, better for large unknown graphs
 *   Neo4j NVL      — direct Neo4j result rendering, only if querying Neo4j
 *
 * For Atlas: @xyflow/react is recommended for Five Case flows and known-structure
 * graphs. AntV G6 is the upgrade path for dynamic corpus-driven networks.
 */

import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ---------------------------------------------------------------------------
// Sample data: 3 themes, 4 projects, 2 funders
// In production this would come from atlas.projects + graphiti knowledge graph
// ---------------------------------------------------------------------------

const NODES: Node[] = [
  // Themes (left column)
  { id: "t1", position: { x: 20, y: 60 }, data: { label: "EV Charging" }, style: { background: "rgba(99,102,241,0.15)", border: "1px solid #6366f1", color: "#a5b4fc", fontSize: 11, borderRadius: 6, padding: "4px 8px", width: 110 } },
  { id: "t2", position: { x: 20, y: 140 }, data: { label: "Active Travel" }, style: { background: "rgba(16,185,129,0.15)", border: "1px solid #10b981", color: "#6ee7b7", fontSize: 11, borderRadius: 6, padding: "4px 8px", width: 110 } },
  { id: "t3", position: { x: 20, y: 220 }, data: { label: "Freight Decarb." }, style: { background: "rgba(245,158,11,0.15)", border: "1px solid #f59e0b", color: "#fcd34d", fontSize: 11, borderRadius: 6, padding: "4px 8px", width: 110 } },

  // Projects (middle column)
  { id: "p1", position: { x: 190, y: 30 }, data: { label: "EV Corridor Pilot" }, style: { background: "rgba(99,102,241,0.08)", border: "1px solid #374151", color: "#f8fafc", fontSize: 10, borderRadius: 4, padding: "3px 7px", width: 120 } },
  { id: "p2", position: { x: 190, y: 110 }, data: { label: "Urban Cycling AI" }, style: { background: "rgba(99,102,241,0.08)", border: "1px solid #374151", color: "#f8fafc", fontSize: 10, borderRadius: 4, padding: "3px 7px", width: 120 } },
  { id: "p3", position: { x: 190, y: 185 }, data: { label: "Smart Freight Hub" }, style: { background: "rgba(99,102,241,0.08)", border: "1px solid #374151", color: "#f8fafc", fontSize: 10, borderRadius: 4, padding: "3px 7px", width: 120 } },
  { id: "p4", position: { x: 190, y: 260 }, data: { label: "Green Logistics Net" }, style: { background: "rgba(99,102,241,0.08)", border: "1px solid #374151", color: "#f8fafc", fontSize: 10, borderRadius: 4, padding: "3px 7px", width: 120 } },

  // Funders (right column)
  { id: "f1", position: { x: 380, y: 100 }, data: { label: "Innovate UK" }, style: { background: "rgba(139,92,246,0.15)", border: "1px solid #8b5cf6", color: "#c4b5fd", fontSize: 11, borderRadius: 6, padding: "4px 8px", width: 100 } },
  { id: "f2", position: { x: 380, y: 195 }, data: { label: "UKRI" }, style: { background: "rgba(139,92,246,0.15)", border: "1px solid #8b5cf6", color: "#c4b5fd", fontSize: 11, borderRadius: 6, padding: "4px 8px", width: 100 } },
];

const EDGES: Edge[] = [
  // Theme → Project
  { id: "e-t1-p1", source: "t1", target: "p1", style: { stroke: "#6366f1", strokeWidth: 1.5 }, animated: false },
  { id: "e-t1-p2", source: "t1", target: "p2", style: { stroke: "#6366f1", strokeWidth: 1 }, animated: false },
  { id: "e-t2-p2", source: "t2", target: "p2", style: { stroke: "#10b981", strokeWidth: 1.5 }, animated: false },
  { id: "e-t3-p3", source: "t3", target: "p3", style: { stroke: "#f59e0b", strokeWidth: 1.5 }, animated: false },
  { id: "e-t3-p4", source: "t3", target: "p4", style: { stroke: "#f59e0b", strokeWidth: 1 }, animated: false },
  // Project → Funder
  { id: "e-p1-f1", source: "p1", target: "f1", style: { stroke: "#8b5cf6", strokeWidth: 1 }, animated: false },
  { id: "e-p2-f1", source: "p2", target: "f1", style: { stroke: "#8b5cf6", strokeWidth: 1 }, animated: false },
  { id: "e-p3-f1", source: "p3", target: "f1", style: { stroke: "#8b5cf6", strokeWidth: 1 }, animated: false },
  { id: "e-p3-f2", source: "p3", target: "f2", style: { stroke: "#8b5cf6", strokeWidth: 1 }, animated: false },
  { id: "e-p4-f2", source: "p4", target: "f2", style: { stroke: "#8b5cf6", strokeWidth: 1 }, animated: false },
];

export function KnowledgeGraph({ className }: { className?: string }) {
  return (
    <div className={className ?? "h-[320px] w-full rounded border border-border"}>
      <ReactFlow
        nodes={NODES}
        edges={EDGES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.5}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#374151"
        />
        <Controls
          showInteractive={false}
          className="!bg-card !border-border [&_button]:!text-muted-foreground [&_button:hover]:!text-foreground"
        />
      </ReactFlow>
    </div>
  );
}
