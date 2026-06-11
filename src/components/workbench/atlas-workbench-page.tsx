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
import { Toaster } from "@/components/ui/ui/sonner";

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
          {/* h-svh + overflow-hidden pins SidebarInset to the viewport.
              Without this, min-h-svh lets the inset grow unbounded and
              inner flex children never get a real height to fill. */}
          <SidebarInset className="overflow-hidden flex flex-col h-svh">
            <WorkbenchHeader />
            {/* min-h-0 is critical: flex items default to min-height:auto
                which prevents them from shrinking — they'd push past the
                viewport instead of clipping. This is the root of the issue. */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <AtlasShell />
            </div>
          </SidebarInset>
        </SidebarProvider>
        {/* Toaster mounts the M2.0 undo-toast affordance. Positioned bottom-right
            so it doesn't collide with the chat composer or PatchConfirmationPanel. */}
        <Toaster position="bottom-right" richColors closeButton />
      </WorkbenchAgentBridge>
    </WorkbenchProvider>
  );
}
