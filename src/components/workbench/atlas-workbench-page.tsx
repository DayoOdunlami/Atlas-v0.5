"use client";

import type { WorkbenchProviderProps } from "@/lib/workbench/workbench-context";
import { WorkbenchProvider } from "@/lib/workbench/workbench-context";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { WorkbenchSidebar } from "./app-sidebar";
import { WorkbenchHeader } from "./site-header";
import { AtlasShell } from "./atlas-shell";
import { WorkbenchAgentBridge } from "./workbench-agent-bridge";

/**
 * Top-level workbench page component.
 *
 * Layer order (outer → inner):
 *   WorkbenchProvider      — model state, loading, CQ selection
 *   WorkbenchAgentBridge   — reads model from context, mounts assistant-ui runtime
 *   SidebarProvider        — layout
 *   AtlasShell             — three-column workbench UI
 *
 * URL params (set by parent server component):
 *   ?match_id=<uuid>   → initialMatchId
 *   ?cq=<cq_id>        → initialCqId
 *
 * Chat transport: WorkbenchAgentBridge → WorkbenchRuntimeProvider
 *   → assistant-ui → LangGraph CLI (port 2024) → workbench graph
 */
export function AtlasWorkbenchPage({
  initialMatchId,
  initialCqId,
}: Pick<WorkbenchProviderProps, "initialMatchId" | "initialCqId">) {
  return (
    <WorkbenchProvider initialMatchId={initialMatchId} initialCqId={initialCqId}>
      <WorkbenchAgentBridge>
        <SidebarProvider defaultOpen={false}>
          <WorkbenchSidebar />
          <SidebarInset className="overflow-hidden">
            <WorkbenchHeader />
            {/* Content area fills remaining height */}
            <div className="flex-1 overflow-hidden" style={{ height: "calc(100vh - 41px)" }}>
              <AtlasShell />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </WorkbenchAgentBridge>
    </WorkbenchProvider>
  );
}
